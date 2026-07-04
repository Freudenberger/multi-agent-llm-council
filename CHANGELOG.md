# Changelog

All notable changes are generated from Conventional Commits by `npm run release`.

## 0.1.5 (2026-07-04)


### Features

* **adr:** add ADR template for decision records ([a97b6f5](https://github.com/Freudenberger/multi-agent-llm-council/commit/a97b6f5a2a4a165929cff93d48ae1787702119ec))
* **agent:** add model selection for agents and update UI ([d26d4f8](https://github.com/Freudenberger/multi-agent-llm-council/commit/d26d4f8f2c506ede42e54a8870aa172817bb0742))
* **agent:** implement customizable agents and UI for agent selection ([f9dff22](https://github.com/Freudenberger/multi-agent-llm-council/commit/f9dff22ea66c57c85cea19450b203bea488e1ebc))
* **agents:** enhance agent templates with final judge role ([ac3f893](https://github.com/Freudenberger/multi-agent-llm-council/commit/ac3f893f09b54fd50895355c7f0423c4042ff66b))
* **ai-review:** add JUnit XML report generation for GitHub Actions ([44219d9](https://github.com/Freudenberger/multi-agent-llm-council/commit/44219d9fa80e292180eb50c52668d03cd1ba07d5))
* **ai-review:** add timeout option for provider calls ([dcd1f37](https://github.com/Freudenberger/multi-agent-llm-council/commit/dcd1f3730b996749ae097665584d1e391288aab8))
* **ai-review:** add v2 CLI and reviewDiffV2 functionality ([8be6611](https://github.com/Freudenberger/multi-agent-llm-council/commit/8be6611519c985499683e2f66e0d3b2e850b208e))
* **ai-review:** add v3 review engine with file reading capability based on Vercel AI SDK and @openrouter/ai-sdk-provider ([a4dbb5a](https://github.com/Freudenberger/multi-agent-llm-council/commit/a4dbb5a96eabc7b9a6035be8e12fa2474d414791))
* **ai-review:** clarify securitySafety scoring criteria ([4e14f20](https://github.com/Freudenberger/multi-agent-llm-council/commit/4e14f2029224bd7b1094e8f8c409af56710a06d5))
* **ai-review:** enhance reviewDiffV2 with retry logic and timeout handling ([da1416c](https://github.com/Freudenberger/multi-agent-llm-council/commit/da1416c832ef92120b38a790376f53a872f0233d))
* **ai-review:** implement AI code review agent with CLI and schema ([af0b8c1](https://github.com/Freudenberger/multi-agent-llm-council/commit/af0b8c1a28c8ead0211bd0ff27767de3b4bee415))
* **ai-review:** implement self-review adjudication loop in CI ([f967dbf](https://github.com/Freudenberger/multi-agent-llm-council/commit/f967dbf4c734f833476c3ae19c0afdac2d3da92f))
* **ai-review:** refine finding emission rules for reviews ([c3b4b23](https://github.com/Freudenberger/multi-agent-llm-council/commit/c3b4b23d92272da9ff2897e903c69c6222a37979))
* **ai-review:** update review CLI and filter logic for v2 ([ab0dc75](https://github.com/Freudenberger/multi-agent-llm-council/commit/ab0dc75c79db6b443f18750600246176d85464e2))
* **api:** add API key validation endpoint for providers ([9de07a6](https://github.com/Freudenberger/multi-agent-llm-council/commit/9de07a6d0f54579b66c7dc92c49469e140597abb))
* **api:** add discussions endpoint for saved history ([1526bf9](https://github.com/Freudenberger/multi-agent-llm-council/commit/1526bf90a9eb5926f84e541f7379eebb93d58dd0))
* **api:** add health and version endpoints to API ([d4e3a55](https://github.com/Freudenberger/multi-agent-llm-council/commit/d4e3a5545c6228125712adb4432aa2dfa612630e))
* **api:** add mockMode reporting to version endpoint ([d600c2e](https://github.com/Freudenberger/multi-agent-llm-council/commit/d600c2e64f65227e7b587d2a01ebf19b03649843))
* **api:** add model comparison dashboard and stats endpoint ([dd7d039](https://github.com/Freudenberger/multi-agent-llm-council/commit/dd7d039cd981b94105ebf82ea4ef1f264e59d89e))
* **api:** add rate limiting and validation for conversations and discussions ([819e364](https://github.com/Freudenberger/multi-agent-llm-council/commit/819e364c34fa9b4b66058593140436ede72eb588))
* **api:** add user settings API for managing provider keys ([f3626fe](https://github.com/Freudenberger/multi-agent-llm-council/commit/f3626fe5b6eb96972ded9b02aff3fd7f4dfb5ed3))
* **api:** enforce user ownership for conversations and limit ([1397380](https://github.com/Freudenberger/multi-agent-llm-council/commit/13973809fd52abf255eca99c4bf623b39994e49f))
* **api:** enhance error handling and validation for council requests ([53cf487](https://github.com/Freudenberger/multi-agent-llm-council/commit/53cf48705faf2178ae09a272cfe54bf62854eced))
* **api:** implement ownership checks for conversations and discussions ([5f0f0e0](https://github.com/Freudenberger/multi-agent-llm-council/commit/5f0f0e0d2c1702ca4f727b9243570006231ad378))
* **auth:** enable trustHost for reverse proxy support ([1d5283c](https://github.com/Freudenberger/multi-agent-llm-council/commit/1d5283c0e277fa8131b9fbc282c72834fbd81ba2))
* **auth:** implement dynamic AUTH_SECRET resolution ([e63759f](https://github.com/Freudenberger/multi-agent-llm-council/commit/e63759fcb7002e4d45191689a065d2ead8572b83))
* **auth:** implement user registration and login functionality ([c016710](https://github.com/Freudenberger/multi-agent-llm-council/commit/c01671008caa77af0ba803f8f2bc609d12ce3ef0))
* **auth:** Supabase storage ([48b1401](https://github.com/Freudenberger/multi-agent-llm-council/commit/48b1401f8f798d0076be668d11530fed6eebdf63))
* **cli:** add CLI documentation and environment loading ([8c209c1](https://github.com/Freudenberger/multi-agent-llm-council/commit/8c209c1bfdf5e366588fcea1876bfb79744e20b5))
* **cli:** add CLI for Multi-Agent LLM Council ([94b608f](https://github.com/Freudenberger/multi-agent-llm-council/commit/94b608f61c9de3eb91ea3f19e828c034e1f26b26))
* **config:** add .npmrc for legacy peer dependencies and update tsconfig to exclude tools ([d7fc12b](https://github.com/Freudenberger/multi-agent-llm-council/commit/d7fc12b2dc5e3f4dc86bc6b0ac19eae46bfc9633))
* **core:** implement retry logic ([2c54fe7](https://github.com/Freudenberger/multi-agent-llm-council/commit/2c54fe7e45c584cbd0b0cebb7e493810ca5f7cd0))
* **council:** add optional peer review phase for analysis ([3207e3a](https://github.com/Freudenberger/multi-agent-llm-council/commit/3207e3ae578ba8c5a8bea1f5b2d45f51ac837a4c))
* **discussion:** add model tracking and download feature ([420b4f4](https://github.com/Freudenberger/multi-agent-llm-council/commit/420b4f4d3b857e513273862c22747420b80e3370))
* **discussion:** add progress indicator and collapsible turns ([3e5eb4a](https://github.com/Freudenberger/multi-agent-llm-council/commit/3e5eb4a6f127e9e88befdd6a69a22e01c6e14126))
* **discussion:** implement live roundtable discussion feature ([44bc357](https://github.com/Freudenberger/multi-agent-llm-council/commit/44bc357a2ea88642735e0159d4199249dc0b9c3c))
* **docker:** add Dockerfile and .dockerignore for multi-stage build ([7d297fa](https://github.com/Freudenberger/multi-agent-llm-council/commit/7d297fac0ba78316b4ad2fe00e1025e833ad412f))
* **docker:** enable standalone build with BUILD_STANDALONE=true ([28937e8](https://github.com/Freudenberger/multi-agent-llm-council/commit/28937e88fa1ad91a2f1beaa6bb3d686449de25f9))
* **docs:** add AI review run screen images ([c36ab73](https://github.com/Freudenberger/multi-agent-llm-council/commit/c36ab731e566a7ff3fd708a8f1ef83a9f23cb073))
* **docs:** add new screen images for documentation ([1983de4](https://github.com/Freudenberger/multi-agent-llm-council/commit/1983de41b15219849113cb2316bb68730b16a2da))
* **docs:** add PRD for Multi-Agent LLM Council project ([a9cd150](https://github.com/Freudenberger/multi-agent-llm-council/commit/a9cd1505fb3b6d87bffaf2e1fbeabbc081cb6b71))
* **docs:** add README for shared AI registry ([a107219](https://github.com/Freudenberger/multi-agent-llm-council/commit/a1072190aa4293720866757eb4b4e4e3ee54a484))
* **docs:** update architecture and features documentation with mermaid diagrams ([c7e3a78](https://github.com/Freudenberger/multi-agent-llm-council/commit/c7e3a78b91c84f5b9042534f9f4d81eeb0c1b9c0))
* **docs:** update README with new council modes and CLI options ([79ba757](https://github.com/Freudenberger/multi-agent-llm-council/commit/79ba75756c2bf18bd328184abb18d772e5168032))
* **e2e:** enhance Playwright tests and add new e2e scenarios ([e7d6326](https://github.com/Freudenberger/multi-agent-llm-council/commit/e7d6326d7b93b11f9a58f2cec6f2f9d9272cd1f8))
* **e2e:** set up Playwright testing environment and add initial tests ([cdfc28a](https://github.com/Freudenberger/multi-agent-llm-council/commit/cdfc28a9ea8cc6f407145f010531f48ffeb114c8))
* **layout:** add favicon and update layout metadata ([7dd543e](https://github.com/Freudenberger/multi-agent-llm-council/commit/7dd543e8964eced49be292b6df5a18bc404df343))
* **logging:** implement raw transcript logging for debugging ([69ebd4f](https://github.com/Freudenberger/multi-agent-llm-council/commit/69ebd4f2088d09bb26ebe1e89269b0ac56ff7956))
* **logging:** implement structured logging across application ([1366a50](https://github.com/Freudenberger/multi-agent-llm-council/commit/1366a50a9cbcc3a7d62fc0b49b5e99bf1b2b88ad))
* **markdown:** add InlineMarkdown component for inline rendering ([370e62a](https://github.com/Freudenberger/multi-agent-llm-council/commit/370e62a64ee6e48d50cc857bb98922519b1467cb))
* **metrics:** add in-process metrics tracking and API endpoints ([85697fc](https://github.com/Freudenberger/multi-agent-llm-council/commit/85697fced8e8039b10a6e5335fe3075c3b1ef430))
* **package:** add release scripts for versioning ([ba7ca1c](https://github.com/Freudenberger/multi-agent-llm-council/commit/ba7ca1c765ce976abaf21f44591732ff3ade7c1a))
* **package:** rename project and add husky support ([a2f540e](https://github.com/Freudenberger/multi-agent-llm-council/commit/a2f540efecd8f2c8cce99924f2bee87ae81a6c2a))
* **provider:** implement bring-your-own-key support ([cf664ce](https://github.com/Freudenberger/multi-agent-llm-council/commit/cf664cea392c83df5028c2519c4f437bda177b38))
* **refactor-opportunities:** document refactor candidates and ranking ([d711f19](https://github.com/Freudenberger/multi-agent-llm-council/commit/d711f19728258afc69bd5e4e01d89a020ed82a99))
* **register:** improve accessibility and styling of registration form ([5fcac7f](https://github.com/Freudenberger/multi-agent-llm-council/commit/5fcac7f3b029af0fa2bf10eaeb33fb4f032cf67f))
* **report:** enhance judge report parsing for truncation detection ([ea60c77](https://github.com/Freudenberger/multi-agent-llm-council/commit/ea60c7766181f938882f005c6e020a891aff4405))
* **settings:** add preferred models management in settings ([c6cf724](https://github.com/Freudenberger/multi-agent-llm-council/commit/c6cf724aad66e759620d494b0ff870db6d959b08))
* **settings:** add validation for API keys and update save conditions ([45f613d](https://github.com/Freudenberger/multi-agent-llm-council/commit/45f613dcf408465e4d0f7eccd923d152fd8f5512))
* **swot:** add SWOT council mode with agents and logic ([62758ca](https://github.com/Freudenberger/multi-agent-llm-council/commit/62758ca930488de0d51d15462a0a6bca94435a3c))
* **tests:** add comprehensive tests for error handling ([2952279](https://github.com/Freudenberger/multi-agent-llm-council/commit/2952279059e6c2b2f5ac0c1383350e496df8b67a))
* **tests:** add coverage reporting with vitest ([8e60b53](https://github.com/Freudenberger/multi-agent-llm-council/commit/8e60b53424da894e7eb631a5f6d43fec67298ab0))
* **tests:** enhance test coverage and add eslint support ([e7353d0](https://github.com/Freudenberger/multi-agent-llm-council/commit/e7353d0e79282ea5f5dd04c00aae2ed58480dbd4))
* **ui:** add header to login and registration pages ([a386216](https://github.com/Freudenberger/multi-agent-llm-council/commit/a386216e34c7e743166218b8d5e5834dd21fb490))
* **ui:** add HistorySidebar for managing saved sessions ([05e1cea](https://github.com/Freudenberger/multi-agent-llm-council/commit/05e1ceac3d22abc78e8fed599a2ac4a923483a74))
* **ui:** add token usage display in responses and reports ([7a13c29](https://github.com/Freudenberger/multi-agent-llm-council/commit/7a13c29849d951c8a71b49ddaeaeb041e70f0cef))
* **ui:** update mode names and add fullName property ([d0cadea](https://github.com/Freudenberger/multi-agent-llm-council/commit/d0cadead816855f9d3a3a0bf57c88aa62b53bb6a))
* **workflow:** add AI review eval regression gate workflow ([a63d6bf](https://github.com/Freudenberger/multi-agent-llm-council/commit/a63d6bf220cb426d5d3b44af903a2a94cc33bc37))
* **workflow:** add build-test-deploy and deploy workflows ([c6daabb](https://github.com/Freudenberger/multi-agent-llm-council/commit/c6daabb51b53aa3f21b69648c0918802813989d2))
* **workflows:** enable push and pull request triggers for build-test ([a70a92f](https://github.com/Freudenberger/multi-agent-llm-council/commit/a70a92f1fb266b36745378a087545c059c135dc0))


### Bug Fixes

* **docker:** pin npm to version 11 to avoid lockfile issues ([e46c88a](https://github.com/Freudenberger/multi-agent-llm-council/commit/e46c88aefe7a709788db9287c61a117fdcf67478))
* **docker:** skip postinstall scripts during npm ci ([5d5431e](https://github.com/Freudenberger/multi-agent-llm-council/commit/5d5431edeaf1426fa9799e93747dcd4fbcf49520))
* **health:** prevent caching of liveness probe responses ([e7afb98](https://github.com/Freudenberger/multi-agent-llm-council/commit/e7afb98250f780f1f27ef5ffd8dc5ed635dbcc33))

## [0.1.4](https://github.com/Freudenberger/multi-agent-llm-council/compare/v0.1.3...v0.1.4) (2026-06-24)


### Features

* **api:** add health and version endpoints to API ([d4e3a55](https://github.com/Freudenberger/multi-agent-llm-council/commit/d4e3a5545c6228125712adb4432aa2dfa612630e))

## [0.1.3](https://github.com/Freudenberger/multi-agent-llm-council/compare/v0.1.2...v0.1.3) (2026-06-24)


### Features

* **api:** add discussions endpoint for saved history ([1526bf9](https://github.com/Freudenberger/multi-agent-llm-council/commit/1526bf90a9eb5926f84e541f7379eebb93d58dd0))
* **docs:** add AI review run screen images ([c36ab73](https://github.com/Freudenberger/multi-agent-llm-council/commit/c36ab731e566a7ff3fd708a8f1ef83a9f23cb073))
* **docs:** add new screen images for documentation ([1983de4](https://github.com/Freudenberger/multi-agent-llm-council/commit/1983de41b15219849113cb2316bb68730b16a2da))
* **ui:** add header to login and registration pages ([a386216](https://github.com/Freudenberger/multi-agent-llm-council/commit/a386216e34c7e743166218b8d5e5834dd21fb490))

## [0.1.2](https://github.com/Freudenberger/multi-agent-llm-council/compare/v0.1.1...v0.1.2) (2026-06-20)


### Features

* **auth:** enable trustHost for reverse proxy support ([1d5283c](https://github.com/Freudenberger/multi-agent-llm-council/commit/1d5283c0e277fa8131b9fbc282c72834fbd81ba2))
* **auth:** implement dynamic AUTH_SECRET resolution ([e63759f](https://github.com/Freudenberger/multi-agent-llm-council/commit/e63759fcb7002e4d45191689a065d2ead8572b83))
* **docker:** enable standalone build with BUILD_STANDALONE=true ([28937e8](https://github.com/Freudenberger/multi-agent-llm-council/commit/28937e88fa1ad91a2f1beaa6bb3d686449de25f9))
* **provider:** implement bring-your-own-key support ([cf664ce](https://github.com/Freudenberger/multi-agent-llm-council/commit/cf664cea392c83df5028c2519c4f437bda177b38))
* **workflow:** add build-test-deploy and deploy workflows ([c6daabb](https://github.com/Freudenberger/multi-agent-llm-council/commit/c6daabb51b53aa3f21b69648c0918802813989d2))

## 0.1.1 (2026-06-20)


### Features

* **agent:** add model selection for agents and update UI ([d26d4f8](https://github.com/Freudenberger/multi-agent-llm-council/commit/d26d4f8f2c506ede42e54a8870aa172817bb0742))
* **agent:** implement customizable agents and UI for agent selection ([f9dff22](https://github.com/Freudenberger/multi-agent-llm-council/commit/f9dff22ea66c57c85cea19450b203bea488e1ebc))
* **agents:** enhance agent templates with final judge role ([ac3f893](https://github.com/Freudenberger/multi-agent-llm-council/commit/ac3f893f09b54fd50895355c7f0423c4042ff66b))
* **ai-review:** add JUnit XML report generation for GitHub Actions ([44219d9](https://github.com/Freudenberger/multi-agent-llm-council/commit/44219d9fa80e292180eb50c52668d03cd1ba07d5))
* **ai-review:** add timeout option for provider calls ([dcd1f37](https://github.com/Freudenberger/multi-agent-llm-council/commit/dcd1f3730b996749ae097665584d1e391288aab8))
* **ai-review:** add v2 CLI and reviewDiffV2 functionality ([8be6611](https://github.com/Freudenberger/multi-agent-llm-council/commit/8be6611519c985499683e2f66e0d3b2e850b208e))
* **ai-review:** clarify securitySafety scoring criteria ([4e14f20](https://github.com/Freudenberger/multi-agent-llm-council/commit/4e14f2029224bd7b1094e8f8c409af56710a06d5))
* **ai-review:** enhance reviewDiffV2 with retry logic and timeout handling ([da1416c](https://github.com/Freudenberger/multi-agent-llm-council/commit/da1416c832ef92120b38a790376f53a872f0233d))
* **ai-review:** implement AI code review agent with CLI and schema ([af0b8c1](https://github.com/Freudenberger/multi-agent-llm-council/commit/af0b8c1a28c8ead0211bd0ff27767de3b4bee415))
* **ai-review:** update review CLI and filter logic for v2 ([ab0dc75](https://github.com/Freudenberger/multi-agent-llm-council/commit/ab0dc75c79db6b443f18750600246176d85464e2))
* **api:** add API key validation endpoint for providers ([9de07a6](https://github.com/Freudenberger/multi-agent-llm-council/commit/9de07a6d0f54579b66c7dc92c49469e140597abb))
* **api:** add user settings API for managing provider keys ([f3626fe](https://github.com/Freudenberger/multi-agent-llm-council/commit/f3626fe5b6eb96972ded9b02aff3fd7f4dfb5ed3))
* **api:** enforce user ownership for conversations and limit ([1397380](https://github.com/Freudenberger/multi-agent-llm-council/commit/13973809fd52abf255eca99c4bf623b39994e49f))
* **api:** enhance error handling and validation for council requests ([53cf487](https://github.com/Freudenberger/multi-agent-llm-council/commit/53cf48705faf2178ae09a272cfe54bf62854eced))
* **auth:** implement user registration and login functionality ([c016710](https://github.com/Freudenberger/multi-agent-llm-council/commit/c01671008caa77af0ba803f8f2bc609d12ce3ef0))
* **auth:** Supabase storage ([48b1401](https://github.com/Freudenberger/multi-agent-llm-council/commit/48b1401f8f798d0076be668d11530fed6eebdf63))
* **cli:** add CLI for Multi-Agent LLM Council ([94b608f](https://github.com/Freudenberger/multi-agent-llm-council/commit/94b608f61c9de3eb91ea3f19e828c034e1f26b26))
* **core:** implement retry logic ([2c54fe7](https://github.com/Freudenberger/multi-agent-llm-council/commit/2c54fe7e45c584cbd0b0cebb7e493810ca5f7cd0))
* **council:** add optional peer review phase for analysis ([3207e3a](https://github.com/Freudenberger/multi-agent-llm-council/commit/3207e3ae578ba8c5a8bea1f5b2d45f51ac837a4c))
* **discussion:** add model tracking and download feature ([420b4f4](https://github.com/Freudenberger/multi-agent-llm-council/commit/420b4f4d3b857e513273862c22747420b80e3370))
* **discussion:** add progress indicator and collapsible turns ([3e5eb4a](https://github.com/Freudenberger/multi-agent-llm-council/commit/3e5eb4a6f127e9e88befdd6a69a22e01c6e14126))
* **discussion:** implement live roundtable discussion feature ([44bc357](https://github.com/Freudenberger/multi-agent-llm-council/commit/44bc357a2ea88642735e0159d4199249dc0b9c3c))
* **docker:** add Dockerfile and .dockerignore for multi-stage build ([7d297fa](https://github.com/Freudenberger/multi-agent-llm-council/commit/7d297fac0ba78316b4ad2fe00e1025e833ad412f))
* **docs:** add PRD for Multi-Agent LLM Council project ([a9cd150](https://github.com/Freudenberger/multi-agent-llm-council/commit/a9cd1505fb3b6d87bffaf2e1fbeabbc081cb6b71))
* **e2e:** enhance Playwright tests and add new e2e scenarios ([e7d6326](https://github.com/Freudenberger/multi-agent-llm-council/commit/e7d6326d7b93b11f9a58f2cec6f2f9d9272cd1f8))
* **e2e:** set up Playwright testing environment and add initial tests ([cdfc28a](https://github.com/Freudenberger/multi-agent-llm-council/commit/cdfc28a9ea8cc6f407145f010531f48ffeb114c8))
* **layout:** add favicon and update layout metadata ([7dd543e](https://github.com/Freudenberger/multi-agent-llm-council/commit/7dd543e8964eced49be292b6df5a18bc404df343))
* **logging:** implement raw transcript logging for debugging ([69ebd4f](https://github.com/Freudenberger/multi-agent-llm-council/commit/69ebd4f2088d09bb26ebe1e89269b0ac56ff7956))
* **logging:** implement structured logging across application ([1366a50](https://github.com/Freudenberger/multi-agent-llm-council/commit/1366a50a9cbcc3a7d62fc0b49b5e99bf1b2b88ad))
* **markdown:** add InlineMarkdown component for inline rendering ([370e62a](https://github.com/Freudenberger/multi-agent-llm-council/commit/370e62a64ee6e48d50cc857bb98922519b1467cb))
* **package:** add release scripts for versioning ([ba7ca1c](https://github.com/Freudenberger/multi-agent-llm-council/commit/ba7ca1c765ce976abaf21f44591732ff3ade7c1a))
* **package:** rename project and add husky support ([a2f540e](https://github.com/Freudenberger/multi-agent-llm-council/commit/a2f540efecd8f2c8cce99924f2bee87ae81a6c2a))
* **refactor-opportunities:** document refactor candidates and ranking ([d711f19](https://github.com/Freudenberger/multi-agent-llm-council/commit/d711f19728258afc69bd5e4e01d89a020ed82a99))
* **register:** improve accessibility and styling of registration form ([5fcac7f](https://github.com/Freudenberger/multi-agent-llm-council/commit/5fcac7f3b029af0fa2bf10eaeb33fb4f032cf67f))
* **report:** enhance judge report parsing for truncation detection ([ea60c77](https://github.com/Freudenberger/multi-agent-llm-council/commit/ea60c7766181f938882f005c6e020a891aff4405))
* **settings:** add preferred models management in settings ([c6cf724](https://github.com/Freudenberger/multi-agent-llm-council/commit/c6cf724aad66e759620d494b0ff870db6d959b08))
* **settings:** add validation for API keys and update save conditions ([45f613d](https://github.com/Freudenberger/multi-agent-llm-council/commit/45f613dcf408465e4d0f7eccd923d152fd8f5512))
* **swot:** add SWOT council mode with agents and logic ([62758ca](https://github.com/Freudenberger/multi-agent-llm-council/commit/62758ca930488de0d51d15462a0a6bca94435a3c))
* **tests:** add comprehensive tests for error handling ([2952279](https://github.com/Freudenberger/multi-agent-llm-council/commit/2952279059e6c2b2f5ac0c1383350e496df8b67a))
* **tests:** add coverage reporting with vitest ([8e60b53](https://github.com/Freudenberger/multi-agent-llm-council/commit/8e60b53424da894e7eb631a5f6d43fec67298ab0))
* **tests:** enhance test coverage and add eslint support ([e7353d0](https://github.com/Freudenberger/multi-agent-llm-council/commit/e7353d0e79282ea5f5dd04c00aae2ed58480dbd4))
* **ui:** add HistorySidebar for managing saved sessions ([05e1cea](https://github.com/Freudenberger/multi-agent-llm-council/commit/05e1ceac3d22abc78e8fed599a2ac4a923483a74))
* **ui:** update mode names and add fullName property ([d0cadea](https://github.com/Freudenberger/multi-agent-llm-council/commit/d0cadead816855f9d3a3a0bf57c88aa62b53bb6a))


### Bug Fixes

* **docker:** pin npm to version 11 to avoid lockfile issues ([e46c88a](https://github.com/Freudenberger/multi-agent-llm-council/commit/e46c88aefe7a709788db9287c61a117fdcf67478))
* **docker:** skip postinstall scripts during npm ci ([5d5431e](https://github.com/Freudenberger/multi-agent-llm-council/commit/5d5431edeaf1426fa9799e93747dcd4fbcf49520))
* **health:** prevent caching of liveness probe responses ([e7afb98](https://github.com/Freudenberger/multi-agent-llm-council/commit/e7afb98250f780f1f27ef5ffd8dc5ed635dbcc33))
