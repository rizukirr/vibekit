// lib/frontmatter.mjs

// Parses a deliberately restricted YAML subset: a leading `---` block of flat
// `key: value` lines. Nesting, lists, and anchors are not supported — a skill
// that needs them is a skill that has outgrown the authoring contract, and we
// want that to be a loud error rather than a silent misparse.
export function parseFrontmatter(text) {
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(text)
  if (!match) throw new Error('missing frontmatter block')

  const data = {}
  for (const raw of match[1].split('\n')) {
    const line = raw.trim()
    if (line === '' || line.startsWith('#')) continue

    const split = line.indexOf(':')
    if (split === -1) throw new Error(`malformed frontmatter line: ${raw}`)

    const key = line.slice(0, split).trim()
    const value = line.slice(split + 1).trim()
    if (key === '') throw new Error(`malformed frontmatter line: ${raw}`)

    data[key] = value === 'true' ? true : value === 'false' ? false : value
  }

  return { data, body: text.slice(match[0].length) }
}
