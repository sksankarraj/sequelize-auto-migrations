import path from 'path';
import fs from 'fs';

export default async function(options = {}) {
  let sequelizercConfigs = {};
  const sequelizercPath = path.join(process.env.PWD || process.cwd(), '.sequelizerc');

  if (fs.existsSync(sequelizercPath)) {
    sequelizercConfigs = await import(sequelizercPath).then(module => module.default);
  }

  if (!process.env.PWD) {
    process.env.PWD = process.cwd();
  }

  const baseDir = process.env.PWD;
  let migrationsDir = path.join(baseDir, 'migrations');
  let modelsDir = path.join(baseDir, 'models');

  if (options['migrations-path']) {
    migrationsDir = path.join(baseDir, options['migrations-path']);
  } else if (sequelizercConfigs['migrations-path']) {
    migrationsDir = sequelizercConfigs['migrations-path'];
  }

  if (options['models-path']) {
    modelsDir = path.join(baseDir, options['models-path']);
  } else if (sequelizercConfigs['models-path']) {
    modelsDir = sequelizercConfigs['models-path'];
  }

  return {
    migrationsDir,
    modelsDir
  };
}
