import { Extension } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { Prec } from "@codemirror/state";

const emmetAbbreviations: Record<string, string> = {
  "div>ul>li": "<div><ul><li></li></ul></div>",
  "div+p": "<div></div><p></p>",
  "ul>li*3": "<ul><li></li><li></li><li></li></ul>",
  "a[href='#']": "<a href='#'></a>",
  "img[src='image.jpg']": "<img src='image.jpg' />",
  "div.container": "<div class='container'></div>",
  "div#header": "<div id='header'></div>",
  "div.row>div.col*3": "<div class='row'><div class='col'></div><div class='col'></div><div class='col'></div></div>",
};

function expandEmmet(abbreviation: string): string {
  if (emmetAbbreviations[abbreviation]) {
    return emmetAbbreviations[abbreviation];
  }

  // Simple expansion for basic patterns
  let result = abbreviation;
  
  // Handle class and id
  result = result.replace(/\.([a-zA-Z0-9_-]+)/g, ' class="$1"');
  result = result.replace(/#([a-zA-Z0-9_-]+)/g, ' id="$1"');
  
  // Handle attributes
  result = result.replace(/\[([a-zA-Z0-9_-]+)=['"]([^'"]*)['"]\]/g, ' $1="$2"');
  
  // Handle child elements
  result = result.replace(/>/g, '><');
  
  // Wrap in tags
  const tagMatch = result.match(/^([a-zA-Z0-9]+)/);
  if (tagMatch && tagMatch[1]) {
    const tag = tagMatch[1];
    result = `<${result.replace(tag, '')}></${tag}>`;
  } else {
    result = `<div>${result}</div>`;
  }
  
  return result;
}

const emmetKeymap = keymap.of([
  {
    key: "Tab",
    run: (view: EditorView) => {
      const selection = view.state.selection.main;
      const line = view.state.doc.line(selection.from);
      const lineText = line.text;
      
      // Check if the line ends with an emmet abbreviation
      const trimmedLine = lineText.trim();
      if (trimmedLine.length > 0) {
        const expanded = expandEmmet(trimmedLine);
        if (expanded !== trimmedLine) {
          view.dispatch({
            changes: {
              from: line.from,
              to: line.to,
              insert: expanded,
            },
            selection: {
              anchor: line.from + expanded.length - 1,
            },
          });
          return true;
        }
      }
      return false;
    },
  },
]);

export function emmet(): Extension {
  return [Prec.highest(emmetKeymap)];
}
