import fs from "fs"
const file = process.argv[2] || "evals/scenarios.json"
const d = JSON.parse(fs.readFileSync(file, "utf8"))
const known = new Set(["skill", "finalTextOmits", "producedFilesOmit"])
const cases = [
  ["plain-omits-curly-quotes", "he said “hi”", "he said \"hi\""],
  ["plain-omits-decorative-emoji", "text\n- ✅ done", "text\n- done"],
  ["plain-omits-title-case-headings", "x\n## Strategic Negotiations And Global", "x\n## Strategic negotiations and global"],
  ["plain-omits-bold-label-list", "x\n- **Performance:** fast", "x\n- performance is fast"],
  ["plain-omits-en-dash-in-artifact", "a – b", "a - b"],
]
for (const [id, hit, miss] of cases) {
  const s = d.find(x => x.id === id)
  if (!s) throw new Error(id + " missing")
  if (s.n !== 10) throw new Error(id + " is not at n of 10")
  for (const k of Object.keys(s.expect)) if (!known.has(k)) throw new Error(id + " has unknown key " + k)
  const v = s.expect.finalTextOmits ?? s.expect.producedFilesOmit
  const re = new RegExp(v)
  if (!re.test(hit)) throw new Error(id + " fails to match the sample it must catch")
  if (re.test(miss)) throw new Error(id + " matches the sample it must allow")
}
