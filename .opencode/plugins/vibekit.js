import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const VibekitPlugin = async () => {
  const vibekitSkillsDir = path.resolve(__dirname, "../../skills");

  return {
    config: async (config) => {
      config.skills = config.skills || {};
      config.skills.paths = config.skills.paths || [];
      if (!config.skills.paths.includes(vibekitSkillsDir)) {
        config.skills.paths.push(vibekitSkillsDir);
      }
    },
  };
};
