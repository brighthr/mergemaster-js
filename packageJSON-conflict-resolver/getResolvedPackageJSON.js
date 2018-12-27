const Document = require('./document');
const parse = require('./parser');
const calculateResolutions = require('./calculateResolutions')

const getResolvedPackageJSON = filePath => {
    let packageJSON = new Document(filePath);
    let hunks = parse(packageJSON);
    // reverse order so we start deleting from bottom up
    // keeps line number counts accurate during resolving
    const hunksWithResolutions = hunks.map(h => calculateResolutions(h, packageJSON)).reverse();
    const canResolveAll = hunksWithResolutions.every(h => h.resolvable === true);

    if (canResolveAll) {
        hunksWithResolutions.forEach(h => {
            const rangeToDeleteStart = h.range.start.line;
            const rangeToDeleteEnd = h.range.end.line - 1;
            const resolution = h.resolution;
            const lineToKeep = h[resolution].content.start.line;
            for (let i = rangeToDeleteEnd; i >= rangeToDeleteStart; i--) {
                if (i !== lineToKeep) {
                    packageJSON.deleteLineAt(i);
                }
            }
        });
        return packageJSON.getDocument();
    }

    return null;
}

module.exports = getResolvedPackageJSON;


