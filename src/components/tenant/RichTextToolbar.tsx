import { Bold, Italic, Underline, List, ListOrdered, Heading2, Link as LinkIcon } from "lucide-react";

type Cmd = { icon: React.ReactNode; cmd: string; arg?: string; title: string };

export function RichTextToolbar({ editorRef }: { editorRef: React.RefObject<HTMLDivElement | null> }) {
  const exec = (cmd: string, arg?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, arg);
  };

  const cmds: Cmd[] = [
    { icon: <Bold className="h-3.5 w-3.5" />, cmd: "bold", title: "Bold" },
    { icon: <Italic className="h-3.5 w-3.5" />, cmd: "italic", title: "Italic" },
    { icon: <Underline className="h-3.5 w-3.5" />, cmd: "underline", title: "Underline" },
    { icon: <Heading2 className="h-3.5 w-3.5" />, cmd: "formatBlock", arg: "<h3>", title: "Heading" },
    { icon: <List className="h-3.5 w-3.5" />, cmd: "insertUnorderedList", title: "Bullet list" },
    { icon: <ListOrdered className="h-3.5 w-3.5" />, cmd: "insertOrderedList", title: "Numbered list" },
  ];

  return (
    <div className="flex items-center gap-0.5 border border-border rounded-lg bg-muted/30 p-1">
      {cmds.map((c) => (
        <button
          key={c.title}
          type="button"
          title={c.title}
          onMouseDown={(e) => { e.preventDefault(); exec(c.cmd, c.arg); }}
          className="p-1.5 rounded hover:bg-background"
        >
          {c.icon}
        </button>
      ))}
      <button
        type="button"
        title="Insert link"
        onMouseDown={(e) => {
          e.preventDefault();
          const url = window.prompt("URL");
          if (url) exec("createLink", url);
        }}
        className="p-1.5 rounded hover:bg-background"
      >
        <LinkIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
