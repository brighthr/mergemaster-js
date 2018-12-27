const axios = require("axios");
const resolveConflicts = require("./resolveConflicts");
const GITHUB_ORGANIZATION = "";
const REPO = "";
const GITHUB_TOKEN = "";
const TIMEOUT = 5000;
const GET_OPEN_PRs_QUERY = `
{
  repository(owner: "${GITHUB_ORGANIZATION}", name: "${REPO}") {
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

      const PRsWithMergeConflicts = PRs.filter(({node: PR}) => {
        return PR.mergeable === MERGEABILITY.CONFLICTING;
      });

      const results = [];
      if (PRsWithMergeConflicts.length) {
        PRsWithMergeConflicts.forEach(({node: PR}) => {
          console.log(`Attempting to resolve conflicts on ${PR.headRefName}`);
          const result = resolveConflicts({
            branchToResolve: PR.headRefName,
            branchToMergeIn: "master",
            url: PR.url
          });
          results.push(result);
        });
        console.log("=== SUMMARY ===");
        console.log(JSON.stringify(results, null, 4));
      } else {
        console.log("No PR that needs resolving merge conflicts.");
      }
    }).catch(e => console.log(e));
};

resolveAll(12);
