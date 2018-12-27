/* Adapted from VSCode */

const startHeaderMarker = '<<<<<<<';
const splitterMarker = '=======';
const endFooterMarker = '>>>>>>>';

const scanItemToMergeConflictDescriptor = scanned => {
    // Validate we have all the required lines within the scan item.
    if (!scanned.startHeader || !scanned.splitter || !scanned.endFooter) {
        return null;
    }

    let tokenAfterCurrentBlock = scanned.splitter;

    // Assume that descriptor.current.header, descriptor.incoming.header and descriptor.splitter
    // have valid ranges, fill in content and total ranges from these parts.
    // NOTE: We need to shift the decorator range back one character so the splitter does not end up with
    // two decoration colors (current and splitter), if we take the new line from the content into account
    // the decorator will wrap to the next line.
    return {
        current: {
            header: scanned.startHeader.range,
            content: {
                start:
                    scanned.startHeader.rangeIncludingLineBreak.end,
                end: tokenAfterCurrentBlock.range.start
            },
            name: scanned.startHeader.text.substring(startHeaderMarker.length + 1)
        },
        splitter: scanned.splitter.range,
        incoming: {
            footer: scanned.endFooter.range,
            content: {
                start: scanned.splitter.rangeIncludingLineBreak.end,
                end: scanned.endFooter.range.start
            },
            name: scanned.endFooter.text.substring(endFooterMarker.length + 1)
        },
        // Entire range is between current header start and incoming header end (including line break)
        range: {
            start: scanned.startHeader.range.start,
            end: scanned.endFooter.rangeIncludingLineBreak.end
        }
    };
}

const scanDocument = document => {
    // Scan each line in the document, we already know there is at least a <<<<<<< and
    // >>>>>> marker within the document, we need to group these into conflict ranges.
    // We initially build a scan match, that references the lines of the header, splitter
    // and footer. This is then converted into a full descriptor containing all required
    // ranges.

    let currentConflict = null;
    const conflictDescriptors = [];

    for (let i = 0; i < document.lineCount; i++) {
        const line = document.lineAt(i);

        // Ignore empty lines
        if (!line || line.isEmptyOrWhitespace) {
            continue;
        }

        // Is this a start line? <<<<<<<
        if (line.text.startsWith(startHeaderMarker)) {
            if (currentConflict !== null) {
                // Error, we should not see a startMarker before we've seen an endMarker
                currentConflict = null;

                // Give up parsing, anything matched up this to this point will be decorated
                // anything after will not
                break;
            }

            // Create a new conflict starting at this line
            currentConflict = { startHeader: line };
        }
        // Are we within a conflict block and is this a splitter? =======
        else if (currentConflict && !currentConflict.splitter && line.text.startsWith(splitterMarker)) {
            currentConflict.splitter = line;
        }
        // Are we within a conflict block and is this a footer? >>>>>>>
        else if (currentConflict && line.text.startsWith(endFooterMarker)) {
            currentConflict.endFooter = line;

            // Create a full descriptor from the lines that we matched. This can return
            // null if the descriptor could not be completed.
            let completeDescriptor = scanItemToMergeConflictDescriptor(currentConflict);

            if (completeDescriptor !== null) {
                conflictDescriptors.push(completeDescriptor);
            }

            // Reset the current conflict to be empty, so we can match the next
            // starting header marker.
            currentConflict = null;
        }
    }

    return conflictDescriptors.filter(Boolean);
}


module.exports = scanDocument;