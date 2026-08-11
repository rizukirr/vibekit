// runtimes/pi.mjs

export const id = 'pi'

// Pi reads a `pi` block from package.json and has native skill support, so a
// skills path is the entire integration. Session-start priming would need an
// extension, which is deferred: it cannot be verified without a Pi install.
export function emit() {
  return {}
}

export function pkg() {
  return { pi: { skills: ['./skills'] } }
}
