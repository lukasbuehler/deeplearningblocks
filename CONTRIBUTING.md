# Contributing

Thanks for helping build Deep Learning Blocks. Every change reaches `main` through a pull request.

## Getting set up

Use the Node version in `.nvmrc` (`nvm use`) and npm.

```sh
npm ci
npm start
```

The development server opens the playground at http://localhost:4200. The [README](README.md) explains how the app works and where the code lives. [ROADMAP.md](ROADMAP.md) lists what is planned and the vocabulary the game uses with players.

## Workflow

`main` is what runs on deeplearningblocks.com: Cloudflare deploys every change to it. Nobody pushes to `main` directly. Day-to-day work happens on `development`.

1. Start from an up-to-date `development` and create a branch with a short, descriptive name, such as `softmax-hint` or `fix-wire-snapping`.
2. Keep each pull request to one change. Small pull requests are reviewed faster.
3. Open the pull request against `development` and fill in the template. Draft pull requests are welcome for early feedback.
4. The **Checks** workflow must pass and the maintainer reviews before merging. Feature pull requests are squash-merged, so the title becomes the commit message.
5. To release, the maintainer opens a pull request from `development` into `main` and merges it with a merge commit, so the two branches keep the same history.

```sh
git switch development && git pull
git switch -c softmax-hint
# ...work, commit...
git push -u origin softmax-hint
gh pr create --base development
```

Collaborators push branches to this repository. Everyone else forks it and opens the pull request from the fork. Both get the same checks and review.

## Before you open a pull request

Run what CI runs:

```sh
npm run format          # or format:check to only verify
npm run test:core       # fast node:test suite for the graph, storage and lessons
npm test -- --watch=false --browsers=ChromeHeadless
npm run build
```

For anything visible, try it in the browser and attach a screenshot or short recording to the pull request.

## Conventions

- Angular follows the rules in [.github/copilot-instructions.md](.github/copilot-instructions.md): standalone components, signals, `input()`/`output()`, OnPush and the built-in control flow.
- Put game logic in plain TypeScript under `src/app/playground/` (such as `graph.ts` and `custom-blocks.ts`) and cover it with a `*.test.ts` file next to it. Components should stay thin.
- Saved boards are validated in `storage.ts`. When you add a field to a block, validate it there so old and malformed saves still load.
- Player-facing text is short, friendly and concrete. Use the terms in ROADMAP.md: _block_, _custom block_, _repeat_, _take apart_.
- Icons are a subsetted Material Symbols font. To use a new icon, add its name to `src/assets/fonts/icons_list.txt` and run `npm run icons:optimize` (setup is in the README), then commit the list, the generated font and `src/index.html` together.
- Prettier does not format Markdown files here. Keep the existing table layout in ROADMAP.md and LEVELS.md.

## Reporting bugs and ideas

Open an issue that describes what you did, what you expected and what happened. Include the browser and a screenshot when you can.
