#!/usr/bin/env node

import path from 'path';
import commandLineArgs from 'command-line-args';
import fs from 'fs';
import Async from 'async';
import * as migrate from '../lib/migrate.js';
import pathConfig from '../lib/pathconfig.js';

const optionDefinitions = [
    { name: 'rev', alias: 'r', type: Number, description: 'Set migration revision (default: 0)', defaultValue: 0 },
    { name: 'rollback', alias: 'b', type: Boolean, description: 'Rollback to specified revision', defaultValue: false },
    { name: 'pos', alias: 'p', type: Number, description: 'Run first migration at pos (default: 0)', defaultValue: 0 },
    { name: 'no-transaction', type: Boolean, description: 'Run each change separately instead of all in a transaction (allows it to fail and continue)', defaultValue: false },
    { name: 'one', type: Boolean, description: 'Do not run next migrations', defaultValue: false },
    { name: 'list', alias: 'l', type: Boolean, description: 'Show migration file list (without execution)', defaultValue: false },
    { name: 'migrations-path', type: String, description: 'The path to the migrations folder' },
    { name: 'models-path', type: String, description: 'The path to the models folder' },
    { name: 'help', type: Boolean, description: 'Show this message' }
];

const options = commandLineArgs(optionDefinitions);

// Windows support
if (!process.env.PWD) {
    process.env.PWD = process.cwd();
}

const { migrationsDir, modelsDir } = await pathConfig(options);
const modelsPath = `${modelsDir}/index.js`

if (!fs.existsSync(modelsPath)) {
    console.log("Can't find models directory. Use `sequelize init` to create it");
    process.exit(1);
}

if (!fs.existsSync(migrationsDir)) {
    console.log("Can't find migrations directory. Use `sequelize init` to create it");
    process.exit(1);
}

if (options.help) {
    console.log("Simple sequelize migration execution tool\n\nUsage:");
    optionDefinitions.forEach((option) => {
        const alias = option.alias ? ` (-${option.alias})` : '\t';
        console.log(`\t --${option.name}${alias} \t${option.description}`);
    });
    process.exit(0);
}

const sequelize = (await import(modelsPath)).default.sequelize;
const queryInterface = sequelize.getQueryInterface();

const fromRevision = options.rev;
const fromPosInitial = parseInt(options.pos);
const stop = options.one;
const rollback = options.rollback;
const noTransaction = options['no-transaction'];

const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(file => file.indexOf('.') !== 0 && file.endsWith('.js'))
    .sort((a, b) => {
        const revA = parseInt(path.basename(a).split('-', 2)[0]);
        const revB = parseInt(path.basename(b).split('-', 2)[0]);
        return rollback ? revB - revA : revA - revB;
    })
    .filter(file => {
        const rev = parseInt(path.basename(file).split('-', 2)[0]);
        return rev >= fromRevision;
    });

console.log("Migrations to execute:");
migrationFiles.forEach(file => console.log(`\t${file}`));

if (options.list) {
    process.exit(0);
}

let fromPos = fromPosInitial;

Async.eachSeries(
    migrationFiles,
    async (file) => {
    console.log(file,);
        console.log(`Execute migration from file: ${file}`);
        try {
            await new Promise((resolve, reject) => {
                migrate.executeMigration(
                    queryInterface,
                    path.join(migrationsDir, file),
                    !noTransaction,
                    fromPos,
                    rollback,
                    (err) => {
                        if (stop) {
                            return new Error("Stopped");
                        }
                        err ? reject(err) : resolve();
                    }
                );
            });
            fromPos = 0; // Reset pos for next migration
        } catch (err) {
            console.error(err);
        }
    },
    (err) => {
        console.log(err || "Migration execution completed");
        process.exit(err ? 1 : 0);
    }
);
