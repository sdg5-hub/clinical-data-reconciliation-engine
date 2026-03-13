type JsonEditorProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

export function JsonEditor({ label, value, onChange }: JsonEditorProps) {
  return (
    <label className="editor">
      <span className="editor__label">{label}</span>
      <textarea
        className="editor__input"
        spellCheck={false}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
