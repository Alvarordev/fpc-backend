<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Demo data

`npm run seed:demo` fills the database with a realistic mock dataset: 15
patients (plus companions), 20 health centers across 12 Peruvian departments,
3 agents, 3 volunteers, 2 foundation users, and their follow-ups, enrollments,
clinical history, psychooncology appointments, reminders and alerts.

> **It deletes everything first.** The seed truncates every domain table before
> inserting, so only the mock dataset survives — that is the point: it clears
> out the generic rows the e2e suites leave behind.

```bash
# Requires the database to be up and migrated
$ npm run migration:run
$ npm run seed:demo
```

Credentials: the admin is whatever `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`
hold; every other seeded account uses `*@fpc.demo` with the password
`Demo1234!`. The `@fpc.demo` domain is deliberately outside the prefixes the
e2e suites clean up, so running the tests will not wipe the demo dataset.

The data is random-looking but reproducible: the generator is seeded from
`SEED_DEMO_SEED` (default `20260805`), and dates are anchored to midnight UTC of
the run day, so two runs on the same day produce an identical dataset. Set
`SEED_DEMO_NOW` to pin the reference date. The seed refuses to run with
`NODE_ENV=production` unless `SEED_DEMO_FORCE=true`.

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## OpenAPI contract

`openapi/openapi.json` is the versioned HTTP contract consumed by the frontend.

```bash
# Regenerate after changing a controller or DTO
$ npm run openapi:generate

# Verify that the committed contract is current
$ npm run openapi:check
```

The OpenAPI GitHub Actions workflow runs the check for pull requests and pushes to `main`.

## n8n webhook notifications

`src/webhooks` dispatches business-event notifications to an n8n workflow: alert created/resolved/
derived, a medical appointment created, or a patient registered. Each is a fire-and-forget `POST` of
`{ "var": "<EventName>", "query": { ... } }`, dispatched only after the triggering database
transaction commits (never on rollback). Failures are logged and swallowed — there is no retry, no
outbox, and the caller's HTTP response is never blocked or failed because of n8n.

Configure it with:

```bash
N8N_WEBHOOK_URL=https://your-n8n-instance/webhook/notificacion
N8N_WEBHOOK_TIMEOUT_MS=5000
```

Leaving `N8N_WEBHOOK_URL` unset or empty disables the integration entirely — every dispatch becomes
a no-op logged at `debug`. There is no default URL; a blank value is required to keep dev/test
environments from ever notifying a real n8n instance by accident.

To verify locally, point `N8N_WEBHOOK_URL` at a capture endpoint (e.g. https://webhook.site), then
create an alert or register a patient and confirm the payload arrives with the expected `var` and
Spanish `query` keys (`nombre`, `DNI`, `celular`, ...).

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
