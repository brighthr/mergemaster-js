const fs = require('fs');

class Document {
    constructor(filePath) {
        const fileContent = fs.readFileSync(filePath);
        this._lines = fileContent.toString('utf8').split('\n');
    }

    get lineCount() {
        return this._lines.length;
    }

    lineAt(i) {
        // https://github.com/Microsoft/vscode/blob/653280d133bf36f182189ded3506d3603d09fcd7/src/vs/workbench/api/node/extHostDocumentData.ts#L150-L151
        const range = {
            start: {
                line: i,
                column: 0
            },
            end: {
                line: i,
                column: this._lines[i].length
            } 
        };
        return { 
            text: this._lines[i],
            rangeIncludingLineBreak: i < this._lines.length - 1 ? {
                start: {
                    line: i,
                    column: 0
                },
                end: {
                    line: i + 1,
                    column: 0
                }
            }: range,
            range: range,
            isEmptyOrWhitespace: this._lines[i].trim().length === 0
        }
    }

    deleteLineAt(i) {
        this._lines.splice(i, 1);
    }

    getDocument() {
        return this._lines.join('\n');
    }
}

module.exports = Document;