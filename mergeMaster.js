const { execSync } = require('child_process');

const merge = ({ branchToResolve, branchToMergeIn, url }) => {
    try {
        execSync(`git checkout -f ${branchToResolve}`);
        execSync(`git pull --rebase`);
        execSync(`git merge --no-commit --no-ff ${branchToMergeIn}`);
        execSync(`git add .`);
        execSync(`git commit -m 'merge-bot merged ${branchToMergeIn} in'`);
        execSync(`git push --no-verify`);
        return {
            branch: branchToResolve,
            url: url,
            status: 'merged',
            error: null
        }
    } catch (err) {
        return {
            branch: branchToResolve,
            url: url,
            status: 'can-not-merge',
            error: err.stdout.toString('utf8').trim()
        }
    }
}

module.exports = merge;