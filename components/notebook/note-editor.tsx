"use client"

import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Link from "@tiptap/extension-link"
import Placeholder from "@tiptap/extension-placeholder"
import { Markdown } from "tiptap-markdown"
import {
  Bold,
  Italic,
  Link2,
  Code,
  Code2,
  List,
  ListOrdered,
  Quote,
  Minus,
  RemoveFormatting,
  Undo2,
  Redo2,
  ChevronDown,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useEffect } from "react"

const HEADING_LEVELS = [
  { label: "Normal", level: 0 },
  { label: "H1", level: 1 },
  { label: "H2", level: 2 },
  { label: "H3", level: 3 },
] as const

export function NoteEditor({
  initialContent,
  placeholder,
  onChange,
}: {
  initialContent: string
  placeholder?: string
  onChange: (markdown: string) => void
}) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: placeholder ?? "" }),
      Markdown.configure({ transformPastedText: true }),
    ],
    content: initialContent
      ? { type: "doc", content: [] } // set via setContent below
      : undefined,
    onUpdate({ editor }) {
      const md = (editor.storage as unknown as { markdown: { getMarkdown: () => string } }).markdown.getMarkdown()
      onChange(md)
    },
  })

  // Load initial content as markdown once editor mounts
  useEffect(() => {
    if (editor && initialContent) {
      editor.commands.setContent(initialContent)
      // Move cursor to end
      editor.commands.focus("end")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor])

  if (!editor) return null

  function currentHeadingLabel() {
    for (const { label, level } of HEADING_LEVELS) {
      if (level === 0 && editor!.isActive("paragraph")) return label
      if (level > 0 && editor!.isActive("heading", { level })) return label
    }
    return "Normal"
  }

  function applyHeading(level: number) {
    if (level === 0) {
      editor!.chain().focus().setParagraph().run()
    } else {
      editor!.chain().focus().toggleHeading({ level: level as 1 | 2 | 3 }).run()
    }
  }

  function addLink() {
    const url = window.prompt("URL eingeben:")
    if (!url) return
    editor!.chain().focus().setLink({ href: url }).run()
  }

  const btn = (active: boolean) =>
    cn(
      "rounded p-1 transition-colors hover:bg-muted",
      active && "bg-muted text-foreground",
      !active && "text-muted-foreground"
    )

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex shrink-0 flex-wrap items-center gap-0.5 border-b px-2 py-1.5">
        <button className={btn(false)} onClick={() => editor.chain().focus().undo().run()} title="Undo">
          <Undo2 className="size-3.5" />
        </button>
        <button className={btn(false)} onClick={() => editor.chain().focus().redo().run()} title="Redo">
          <Redo2 className="size-3.5" />
        </button>

        <div className="mx-1.5 h-4 w-px bg-border" />

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            {currentHeadingLabel()}
            <ChevronDown className="size-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {HEADING_LEVELS.map(({ label, level }) => (
              <DropdownMenuItem key={level} onClick={() => applyHeading(level)}>
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="mx-1.5 h-4 w-px bg-border" />

        <button className={btn(editor.isActive("bold"))} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold">
          <Bold className="size-3.5" />
        </button>
        <button className={btn(editor.isActive("italic"))} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic">
          <Italic className="size-3.5" />
        </button>
        <button className={btn(editor.isActive("link"))} onClick={addLink} title="Link">
          <Link2 className="size-3.5" />
        </button>
        <button className={btn(editor.isActive("code"))} onClick={() => editor.chain().focus().toggleCode().run()} title="Inline Code">
          <Code className="size-3.5" />
        </button>
        <button className={btn(editor.isActive("codeBlock"))} onClick={() => editor.chain().focus().toggleCodeBlock().run()} title="Code Block">
          <Code2 className="size-3.5" />
        </button>

        <div className="mx-1.5 h-4 w-px bg-border" />

        <button className={btn(editor.isActive("bulletList"))} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet List">
          <List className="size-3.5" />
        </button>
        <button className={btn(editor.isActive("orderedList"))} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Ordered List">
          <ListOrdered className="size-3.5" />
        </button>
        <button className={btn(editor.isActive("blockquote"))} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Blockquote">
          <Quote className="size-3.5" />
        </button>
        <button className={btn(false)} onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal Rule">
          <Minus className="size-3.5" />
        </button>
        <button className={btn(false)} onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()} title="Clear Formatting">
          <RemoveFormatting className="size-3.5" />
        </button>
      </div>

      {/* Editor content */}
      <EditorContent
        editor={editor}
        className="prose prose-sm prose-invert flex-1 max-w-none overflow-y-auto px-4 py-3 focus-within:outline-none [&_.tiptap]:min-h-full [&_.tiptap]:outline-none [&_.tiptap_p.is-editor-empty:first-child::before]:pointer-events-none [&_.tiptap_p.is-editor-empty:first-child::before]:float-left [&_.tiptap_p.is-editor-empty:first-child::before]:h-0 [&_.tiptap_p.is-editor-empty:first-child::before]:text-muted-foreground [&_.tiptap_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]"
      />
    </div>
  )
}
