const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const getResolvedPackageJSON = require('./packageJSON-conflict-resolver/getResolvedPackageJSON');

const getListOfConflictingFiles = conflicts => {
    const filtered = conflicts.map(c => {
        if (c.startsWith('CONFLICT')) {
            const [file] = c.split(' ').reverse();
            return file;
        }
        return '';
    }).filter(c => c !== '');
    return filtered;
}

const checkoutBranch = branchName => {
    execSync(`git checkout -f ${branchName}`);
    execSync(`git pull --rebase`);
}

const attemptMergeToGetListOfConflictingFiles = branchToMergeIn => {
    let conflictingFiles = '';
    try {
        // below line will exit with status code 1 due to merge conflicts
        // we will capture the stdout and parse it within catch block
        execSync(`git merge --no-commit --no-ff ${branchToMergeIn}`);
    } catch (err) {
        const output = err.stdout.toString('utf8');
        const files = output.split('\n');
        conflictingFiles = getListOfConflictingFiles(files);
    }
    return conflictingFiles;
}

const bail = (branchToResolve, url, err) => {
    console.log(`Could not resolve conflicts on ${branchToResolve}`);
    execSync('git merge --abort');
    return {
        branch: branchToResolve,
        url: url,
        status: 'can-not-merge',
        error: err
    }
}

const resolve = ({ branchToResolve, branchToMergeIn, url }) => {
    checkoutBranch(branchToResolve)
    const conflictingFiles = attemptMergeToGetListOfConflictingFiles(branchToMergeIn);

    const onlyPackageJSONAndLockFileConflicts = conflictingFiles.every(f => f === 'package-lock.json' || f === 'package.json');
    if (!onlyPackageJSONAndLockFileConflicts) {
        return bail(branchToResolve, url, 'Conflict includes files other than package.json and package-lock.json');
    }

    if (conflictingFiles.includes('package.json')) {
        const resolvedPackageJSON = getResolvedPackageJSON(path.join(process.cwd(), 'package.json'));
        if (resolvedPackageJSON) {
            fs.writeFileSync(path.join(process.cwd(), 'package.json'), resolvedPackageJSON);
            execSync('git add package.json');
        } else {
            return bail(branchToResolve, url, 'Can not resolve package.json');
        }
    }

    if (conflictingFiles.includes('package-lock.json')) {
        try {
            execSync('rm package-lock.json && rm -rf node_modules && npm i && git add package-lock.json');
        } catch (err) {
            return bail(branchToResolve, url, err.stdout.toString('utf8').trim());
        }
    }

    try {
        execSync(`git commit -m 'resolved conflicts :wizard:'`);
        execSync(`git push --no-verify`);
    } catch (err) {
        return bail(branchToResolve, url, err.stdout.toString('utf8').trim());
    }

    console.log(`Resolved conflicts on ${branchToResolve}`);
    return {
        branch: branchToResolve,
        url: url,
        status: 'merged',
        error: null
    }
}

module.exports = resolve;