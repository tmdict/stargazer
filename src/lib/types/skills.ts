// Derived from src/content/skill/ directories at build time via import.meta.glob
const skillModules = import.meta.glob('@/content/skill/*/*.en.vue')

export const DOCUMENTED_SKILLS = Object.keys(skillModules)
  .map((path) => {
    const parts = path.split('/')
    return parts[parts.length - 2]!
  })
  .sort()
