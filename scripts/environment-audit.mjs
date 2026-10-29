export function detectSkills(options = {}) {
  const home = options.home ?? os.homedir();
  const codexHome = process.env.CODEX_HOME || path.join(home, '.codex');
  const roots = [
    { path: path.join(home, '.claude', 'skills'), label: '~/.claude/skills' },
    { path: path.join(home, '.agents', 'skills'), label: '~/.agents/skills' },
    { path: path.join(codexHome, 'skills'), label: process.env.CODEX_HOME ? '$CODEX_HOME/skills' : '~/.codex/skills' },
  ];
  if (options.project) {
    roots.push({ path: path.join(options.project, '.claude', 'skills'), label: '<project>/.claude/skills' });
    roots.push({ path: path.join(options.project, '.agents', 'skills'), label: '<project>/.agents/skills' });
  }
  const rootRecords = roots.map(({ path: rootPath, label }) => {
    const found = isDir(rootPath);
    const displayRoot = displayPath(rootPath);
    return { root: displayRoot, label, found, names: found ? skillNamesIn(rootPath) : [] };
  });
  const plugins = [];
  const cache = path.join(home, '.claude', 'plugins', 'cache');
