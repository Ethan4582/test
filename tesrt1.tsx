
import { GithubRepoLoader } from '@langchain/community/document_loaders/web/github';

import { Document } from '@langchain/core/documents';
import { generateEmbeddings, summarizeCode } from './gemini';
import { db } from '~/server/db';
import { Octokit } from 'octokit';


// recursive function to check the count of the file 
const getFileCount = async (path: string, octokit: Octokit, githubOwner: string, githubRepo: string, acc: number = 0) => {
    const { data } = await octokit.rest.repos.getContent({
        owner: githubOwner,
        repo: githubRepo,
        path
    })
    if (!Array.isArray(data) && data.type === 'file') {
        return acc + 1
    }
    if (Array.isArray(data)) {
        let fileCount = 0
const directories: string[] = []

for (const item of data) {
    if (item.type === 'dir') {
        directories.push(item.path)
    } else {
        fileCount++;
    }
}

if (directories.length > 0) {
    const directoryCounts = await Promise.all(
        directories.map(dirPath => getFileCount(dirPath, octokit, githubOwner, githubRepo, 0))
    )
    fileCount += directoryCounts.reduce((acc, count) => acc + count, 0)
}
 return acc=fileCount;
    }
    return acc
   
}

export const checkCredits = async (githubUrl: string, githubToken?: string) => {
    // find out how many files are in the repo
    const octokit = new Octokit({ auth: githubToken })
    const githubOwner = githubUrl.split('/')[3]
    const githubRepo = githubUrl.split('/')[4]
    if (!githubOwner || !githubRepo) {
        return 0
    }

    const fileCount= await getFileCount('', octokit, githubOwner, githubRepo, 0)
    return fileCount
}


const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));


function isComplexFile(fileName: string, content: string): boolean {
  return content.length > 20000 || 
         fileName.includes('test') || 
         fileName.endsWith('.json');
}









export const loadGithubRepo = async (repoUrl: string, githubToken?: string) => {
  try {
    // Always try to use a token to avoid rate limits
    const token = githubToken || process.env.GITHUB_TOKEN;
    
    if (!token) {
      console.warn("⚠️ No GitHub token provided! You will hit rate limits quickly.");
    }
    
    const loader = new GithubRepoLoader(repoUrl, {
      accessToken: token, 
    
    "LICENSE.md",
    "LICENSE.txt",
    
    // Config overrides
    ".eslintignore",
    ".prettierignore",
    ".stylelintignore",
    
    // Miscellaneous
    ".yarnrc.yml",
    ".yarnrc",
    ".npmrc",
    ".prettierrc",
    ".eslintrc.js",
    ".stylelintrc.js",
    "jest.config.js",
    "webpack.config.js",
    "vite.config.js",
    "tsconfig.json",
    "jsconfig.json",
    ".dockerignore",
    ".gitattributes",
    ".gitignore",
    ".editorconfig",
    ".babelrc",
    ".commitlintrc.js"
  ],
      recursive: true,
      unknown: 'warn',
      maxConcurrency: 2, // Lower this to avoid hitting limits
    });

    try {
      const docs = await loader.load();
      return docs;
    } catch (error: any) {
      // Better error handling for GitHub rate limits
      if (error.message?.includes('rate limit exceeded')) {
        throw new Error("GitHub API rate limit exceeded. Please provide a valid GitHub token or try again later.");
      }
      throw error;
    }
  } catch (error) {
    console.error("Error loading GitHub repo:", error);
    throw error;
  }
};





//load the file and generate embeddings for each file

export const indexGithubRepo = async (repoUrl: string, githubToken?: string, projectId?: string) => {
  try {
    // Step 1: Load all documents from GitHub
  
    const docs = await loadGithubRepo(repoUrl, githubToken);
  
    
    // Step 2: First summarize ALL files with extreme rate limiting

    const summaries = await summarizeAllFilesSequentially(docs);
  
    
    // Step 3: Generate embeddings for all summaries with rate limiting
  
    const embeddingsData = await generateEmbeddingsSequentially(summaries);
  

    for (let i = 0; i < embeddingsData.length; i++) {
      const embedding = embeddingsData[i];
      if (!embedding) continue; // Type guard: skip if undefined

      try {
        console.log(`Saving data for ${embedding.fileName} (${i+1}/${embeddingsData.length})`);

        const data: any = {
          summary: embedding.summary,
          fileName: embedding.fileName,
          sourceCode: embedding.sourceCode,
        };
        if (projectId !== undefined) {
          data.projectId = projectId;
        }

        const sourceCodeEmbedding = await db.sourceCodeEmbedding.create({
          data
        });

        await db.$executeRaw`UPDATE "SourceCodeEmbedding" SET "summaryEmbedding" = ${embedding.embedding} :: vector WHERE "id" = ${sourceCodeEmbedding.id}`;

        await sleep(1000);
      } catch (error) {
        console.error(`Error saving data for ${embedding?.fileName ?? "unknown"}:`, error);
      }
    }
    

    return docs;
  } catch (error) {
   
    throw error;
  }
};




// STEP 2: Summarize all files with extreme rate limiting
async function summarizeAllFilesSequentially(docs: Document[]) {
  const summaries = [];
  const totalFiles = docs.length;
  const startTime = Date.now();
  const minimumTotalDuration = 10 * 1000; // 10 seconds minimum (reduced from 5 minutes)
  
  console.log(`Starting summarization of ${totalFiles} files`);
  
  for (let i = 0; i < totalFiles; i++) {
    const doc = docs[i];
    if (!doc) continue; 
    const fileName = doc.metadata?.source ?? "unknown";
    console.log(`Summarizing file ${i+1}/${totalFiles}: ${fileName}`);
    
    try {
      // Try to summarize with retry logic
      let summary = null;
      let attempts = 0;
      const maxAttempts = 5;
      
      while (attempts < maxAttempts) {
        try {
          // Calculate delay based on file complexity
          const baseDelay = isComplexFile(fileName, doc.pageContent) ? 30000 : 15000; 
          
          summary = await summarizeCode(doc);
          console.log(`✓ Successfully summarized ${fileName}`);
          break; 
        } catch (error: any) {
          attempts++;
          console.error(`Attempt ${attempts}/${maxAttempts} failed for ${fileName}:`, error.message);
          
          if (error.status === 429 || error.message?.includes('rate limit')) {
            // If rate limited, wait longer
            const backoffTime = Math.pow(2, attempts) * 30000; 
            console.log(`⏳ Rate limit hit, waiting ${backoffTime/1000}s before retry...`);
            await sleep(backoffTime);
          } else if (attempts < maxAttempts) {
            // For other errors, wait a bit less
            await sleep(10000); // 10 seconds
          } else {
            
            throw error;
          }
        }
      }
      
      if (summary) {
        summaries.push({
          fileName,
          summary,
          sourceCode: doc.pageContent
        });
      }

     
      const baseDelay = isComplexFile(fileName, doc.pageContent) ? 4000 : 2000;
    
      await sleep(baseDelay);
    } catch (error) {
      console.error(`Error processing ${fileName}:`, error);
    }
  }
  
  // Check if we need to wait longer to meet minimum duration
  const elapsed = Date.now() - startTime;
  const remaining = minimumTotalDuration - elapsed;
  
  if (remaining > 0) {
   
    await sleep(remaining);
  }
  
  return summaries;
}

// STEP 3: Generate embeddings sequentially with rate limiting
async function generateEmbeddingsSequentially(summaries: Array<{fileName: string, summary: string, sourceCode: string}>) {
  const results = [];
  const totalSummaries = summaries.length;
  
  console.log(`Starting embedding generation for ${totalSummaries} summaries`);
  
  for (let i = 0; i < totalSummaries; i++) {
    const summaryObj = summaries[i];
    if (!summaryObj) continue; 
    const { fileName, summary, sourceCode } = summaryObj;
    console.log(`Generating embedding ${i+1}/${totalSummaries}: ${fileName}`);
    
    try {
      // Try to generate embedding with retry logic
      let embedding = null;
      let attempts = 0;
      const maxAttempts = 5;
      
      while (attempts < maxAttempts) {
        try {
          embedding = await generateEmbeddings(summary);
        
          break; 
        } catch (error: any) {
          attempts++;
         
          if (error.status === 429 || error.message?.includes('rate limit')) {
            // If rate limited, wait longer
            const backoffTime = Math.pow(2, attempts) * 30000; // 30s, 60s, 120s
            
            await sleep(backoffTime);
          } else if (attempts < maxAttempts) {
           
            await sleep(10000);
          } else {
            // Max attempts reached
            
            throw error;
          }
        }
      }
      
      if (embedding) {
        results.push({
          fileName,
          summary,
          embedding,
          sourceCode
        });
      }

      // Fixed delay between API calls (4-6 seconds)
      const delay = 2000 + Math.random() * 2000; 
     
      await sleep(delay);
    } catch (error) {
      console.error(`Error generating embedding for ${fileName}:`, error);
    }
  }
  
  
  return results;
}
