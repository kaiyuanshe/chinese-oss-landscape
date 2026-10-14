# UI development

The SolidJS web application is located in this directory. Install its dependencies
and start the Vite development server from the repository root:

```text
npm run dev
```

This command builds the local site, prepares datasets and generated assets in
`ui/webapp/static`, and starts Vite. Restart it after changing YAML inputs or logos.
For the generated production site, run `npm run build` and `npm run preview`.

To develop against data from an existing landscape, copy the
example environment file and configure the landscape URL:

```text
cp ui/webapp/.env.local.example ui/webapp/.env.local
```

```text
VITE_PROXY_TARGET=https://landscape.cncf.io
```

Restart the development server after changing `.env.local`. The proxy handles
datasets, documents, images, and logos during development only; production
builds are not affected. Remove `VITE_PROXY_TARGET` to use the local generated
assets again.
