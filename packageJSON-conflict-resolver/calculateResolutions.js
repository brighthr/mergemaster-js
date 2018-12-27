const semver = require('semver');

const isSingleLineChange = partition => {
    return partition.content.start.line + 1 === partition.content.end.line;
}

const calculateResolutions = (hunk, document) => {
    const PACKAGE_NAME_AND_VERSION_REGEX = /"([^":]*)": "([^":]*)/g;
    let resolvable = false;
    let resolution = null;

    const current = hunk.current;
    const incoming = hunk.incoming;

    if (isSingleLineChange(current) && isSingleLineChange(incoming)) {
        const ours = document.lineAt(current.content.start.line).text;
        const theirs = document.lineAt(incoming.content.start.line).text;

        const [, ourPackage, ourVersion] = PACKAGE_NAME_AND_VERSION_REGEX.exec(ours)
        PACKAGE_NAME_AND_VERSION_REGEX.lastIndex = 0; // reset the regex for second use
        const [, theirPackage, theirVersion] = PACKAGE_NAME_AND_VERSION_REGEX.exec(theirs)
        const ourVersionClean = ourVersion.replace(/[^0-9.]/, '');
        const theirVersionClean = theirVersion.replace(/[^0-9.]/, '');

        if (ourPackage === theirPackage && semver.valid(ourVersionClean) && semver.valid(theirVersionClean)) {
            resolvable = true;
            resolution = semver.gt(ourVersionClean, theirVersionClean) ? 'current' : 'incoming';
        }
    } 
    return {
        ...hunk,
        resolvable,
        resolution
    }
}

module.exports = calculateResolutions