import { Injectable } from "@angular/core";

// eslint-disable-next-line  @typescript-eslint/no-explicit-any
declare const monaco: any;

@Injectable({
  providedIn: 'root',
})

export class MonacoService {

  private _initialized = false;

  init() {
    if (this._initialized) {
      return;
    }

    this.registerJsonAutoSuggestionVariables();

    this._initialized = true;
  }

  private registerJsonAutoSuggestionVariables() {
    function createDependencyProposals(range) {
      // returning a static list of proposals, not even looking at the prefix (filtering is done by the Monaco editor),
      // here you could do a server side lookup
      return [
        {
          label: '"@@flag.name"',
          kind: monaco.languages.CompletionItemKind.Variable,
          documentation: "The name of the feature flag",
          insertText: '@@flag.name',
          range: range
        },
        {
          label: '"@@flag.description"',
          kind: monaco.languages.CompletionItemKind.Variable,
          documentation: "The description of the feature flag",
          insertText: '@@flag.description',
          range: range
        }
      ];
    }

    monaco.languages.registerCompletionItemProvider("json", {
      provideCompletionItems: function (model, position) {
        // Get the text before the cursor
        const word = model.getWordUntilPosition(position);

        const idx = word.word.lastIndexOf('@');
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn + Math.max(0, idx),
          endColumn: word.endColumn,
        };

        return { suggestions: createDependencyProposals(range) };
      },

      triggerCharacters: ['@']
    });
  }
}