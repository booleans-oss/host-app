#!/usr/bin/env node
import 'reflect-metadata';

import process from 'process';
import { container } from 'tsyringe';

import { InputController } from './controllers';

process.on('SIGINT', () => {
  // TODO: clean out
  console.warn('About to exit with code');
  process.exit();
});

async function __main__() {
  const inputController = container.resolve(InputController);
  await inputController.start();
}

void __main__();
