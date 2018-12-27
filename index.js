const axios = require("axios");
const { execSync } = require('child_process');
const resolveConflicts = require("./resolveConflicts");
const mergeMasterIn = require("./mergeMaster");

const GITHUB_ORGANIZATION = process.env.GITHUB_ORGANIZATION;
const GITHUB_REPO = process.env.GITHUB_REPO;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GIT_NAME = process.env.GIT_NAME;
const GIT_EMAIL = process.env.GIT_EMAIL;
const MASTER_BRANCH = process.env.MASTER_BRANCH || 'master';
const TIMEOUT = process.env.RETRY_TIMEOUT || 5000;

if(!GITHUB_ORGANIZATION) {
  console.log('GITHUB_ORGANIZATION environment variable is not defined.');
  process.exit(1);
}

if(!GITHUB_REPO) {
  console.log('GITHUB_REPO environment variable is not defined.');
  process.exit(1);
}

if(!GITHUB_TOKEN) {
  console.log('GITHUB_TOKEN environment variable is not defined.');
  process.exit(1);
}

if(!GIT_EMAIL) {
  console.log('GIT_EMAIL environment variable is not defined.');
  process.exit(1);
}

if(!GIT_NAME) {
  console.log('GIT_EMAIL environment variable is not defined.');
  process.exit(1);
}

execSync(`git config --global user.email "${GIT_EMAIL}"`);
execSync(`git config --global user.name "${GIT_NAME}"`);

const GET_OPEN_PRs_QUERY = `
{
  repository(owner: "${GITHUB_ORGANIZATION}", name: "${GITHUB_REPO}") {
    pullRequests(last: 100, states: OPEN) {
      edges {
        node {
          id
          number
          url
          baseRefName
          headRefName
          mergeable
        }
      }
      
    }
    name
  }
}
`;

// https://developer.github.com/v4/enum/mergeablestate/
const MERGEABILITY = {
  CONFLICTING: "CONFLICTING",
  MERGEABLE: "MERGEABLE",
  UNKNOWN: "UNKNOWN"
};

const resolveAll = retries => {
  axios({
    url: "https://api.github.com/graphql",
    method: "POST",
    headers: {
      Authorization: `bearer ${GITHUB_TOKEN}`
    },
    data: {
      query: GET_OPEN_PRs_QUERY
    }
  })
    .then( data  => {
      const PRs = data.data.data.repository.pullRequests.edges;
      const areThereAnyPRsWithUnknownMergeabilityStatus = PRs.some(({node: PR}) => {
        return PR.mergeable === MERGEABILITY.UNKNOWN;
      });

      if (areThereAnyPRsWithUnknownMergeabilityStatus && retries) {
        console.log(
          `Found some PRs with unknown mergeability status retrying in ${TIMEOUT /
            1000} secs.`
        );
        setTimeout(() => resolveAll(retries - 1), TIMEOUT);
        return;
      }

      const results = [];
      const PRsWithoutMergeConflicts = PRs.filter(({node: PR}) => {
        return PR.mergeable === MERGEABILITY.MERGEABLE;
      });

      PRsWithoutMergeConflicts.forEach(({ node: PR }) => {
        console.log(`Merging master into ${PR.headRefName}`);
        const result = mergeMasterIn({
          branchToResolve: PR.headRefName,
          branchToMergeIn: MASTER_BRANCH,
          url: PR.url
        });
        results.push(result);
      });

      const PRsWithMergeConflicts = PRs.filter(({node: PR}) => {
        return PR.mergeable === MERGEABILITY.CONFLICTING;
      });

      
      if (PRsWithMergeConflicts.length) {
        PRsWithMergeConflicts.forEach(({node: PR}) => {
          console.log(`Attempting to resolve conflicts on ${PR.headRefName}`);
          const result = resolveConflicts({
            branchToResolve: PR.headRefName,
            branchToMergeIn: MASTER_BRANCH,
            url: PR.url
          });
          results.push(result);
        });
        console.log("=== SUMMARY ===\n");
        results.forEach(({branch, url, status, error}) => {
          console.log(`Branch: ${branch}`);
          console.log(`URL: ${url}`);
          console.log(`Status: ${status}`);
          if(error) {
            console.log(`Error: ${error}`);
          }
          console.log('\n');
        })
      } else {
        console.log("No PR that needs resolving merge conflicts.");
      }
    }).catch(e => console.log(e));
};

resolveAll(12);
