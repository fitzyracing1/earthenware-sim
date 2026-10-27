# Earthenware punch-card simulator

> **Status:** Partial code: TypeScript simulator, assembler, CLI, sample decks and tests, copied from the local build on Joshua's bot box. Built locally and not published before now.

A punch-card machine simulator. Each card has 13 holes (1 bypass, 4 instruction, 8 number). A punched bypass hole sends the card through a mod-30 "kiln", so 5x9 prints 15 instead of 45.

## Where this came from

This idea came up in a chat with one of Joshua Almeida's bots (EC bot, Oct 17 2026) and was not taken further at the time. This repo records it so it can be picked up later.

## Code in this repo

The code here was copied as-is from the local build. Its original notes are in [BUILD_NOTES.md](BUILD_NOTES.md). It has not been re-verified for this repo.

## Contributing

Ideas, issues and pull requests are welcome.

## License

MIT
