# Deploying `dist/` to AWS S3

The app is fully client-side (the engineering engines run in the browser), so the production site is plain static
files. `pnpm build:dist` produces them in `dist/`; the workflow `.github/workflows/deploy-s3.yml` uploads **only
`dist/`** to your bucket. No server, no Node runtime, no secrets in the bundle.

## Verify locally first

```bash
pnpm verify:dist          # builds dist/ (static export + integrity checks), then serves it
# or: ./run.sh dist
# open http://127.0.0.1:8080
```

| Command            | What it does                                                                                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm build:dist`  | Static export → `dist/`, writes `dist/build-info.json`, runs the integrity checks (required files, no `.env` / source maps / keys, every `/_next/...` reference exists, no localhost URLs) |
| `pnpm serve:dist`  | Serves `dist/` like S3 + CloudFront: `/` → `index.html`, unknown path → `404.html` (status 404), hashed assets `immutable`, HTML `no-cache`, path traversal blocked                        |
| `pnpm verify:dist` | `build:dist` then `serve:dist`                                                                                                                                                             |

`PORT=9000 pnpm serve:dist` changes the port. For a site hosted under a URL prefix:
`BASE_PATH=/civil pnpm verify:dist` (build and serve with the same prefix).

## One-time AWS setup

Replace `ACCOUNT`, `BUCKET`, `DIST_ID`, `OWNER/REPO`.

1. **Bucket** — create a **dedicated** bucket (the pipeline mirrors `dist/` with `--delete`, so anything else in
   it or in the chosen prefix would be removed). Keep _Block all public access_ **on** and serve through CloudFront.
   Optional: enable versioning to roll back individual objects.
2. **CloudFront** — create a distribution with the bucket as origin using **Origin Access Control (OAC)**; default
   root object `index.html`; viewer protocol _Redirect HTTP to HTTPS_; custom error response for 403/404 →
   `/404.html` with HTTP status 404. Bucket policy for OAC:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "AllowCloudFrontRead",
         "Effect": "Allow",
         "Principal": { "Service": "cloudfront.amazonaws.com" },
         "Action": "s3:GetObject",
         "Resource": "arn:aws:s3:::BUCKET/*",
         "Condition": {
           "StringEquals": { "AWS:SourceArn": "arn:aws:cloudfront::ACCOUNT:distribution/DIST_ID" }
         }
       }
     ]
   }
   ```

   Attach a **response headers policy** (S3 cannot send headers): `Strict-Transport-Security`
   (`max-age=63072000; includeSubDomains; preload`), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
   `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`
   and the same CSP the server build uses:
   `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`.
   (The HTML also carries a `<meta>` CSP, which cannot express `frame-ancestors`.)

3. **GitHub OIDC provider** (once per AWS account): IAM → Identity providers → OpenID Connect →
   `https://token.actions.githubusercontent.com`, audience `sts.amazonaws.com`.
4. **Deploy role** with this **trust policy** (only this repository's `production` environment can assume it):

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Principal": {
           "Federated": "arn:aws:iam::ACCOUNT:oidc-provider/token.actions.githubusercontent.com"
         },
         "Action": "sts:AssumeRoleWithWebIdentity",
         "Condition": {
           "StringEquals": {
             "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
             "token.actions.githubusercontent.com:sub": "repo:OWNER/REPO:environment:production"
           }
         }
       }
     ]
   }
   ```

   and this **least-privilege permissions policy**:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "ListBucket",
         "Effect": "Allow",
         "Action": ["s3:ListBucket", "s3:GetBucketLocation"],
         "Resource": "arn:aws:s3:::BUCKET"
       },
       {
         "Sid": "WriteSite",
         "Effect": "Allow",
         "Action": ["s3:PutObject", "s3:DeleteObject"],
         "Resource": "arn:aws:s3:::BUCKET/*"
       },
       {
         "Sid": "Invalidate",
         "Effect": "Allow",
         "Action": "cloudfront:CreateInvalidation",
         "Resource": "arn:aws:cloudfront::ACCOUNT:distribution/DIST_ID"
       }
     ]
   }
   ```

   With a `S3_PREFIX`, narrow `WriteSite` to `arn:aws:s3:::BUCKET/PREFIX/*` and add a `s3:prefix` condition to `ListBucket`.

5. **GitHub** → Settings → Environments → create `production` (add _required reviewers_ if you want a manual
   approval before every upload). Then Settings → Secrets and variables → Actions → **Variables**:

   | Variable                     | Example                                           | Required |
   | ---------------------------- | ------------------------------------------------- | -------- |
   | `AWS_ROLE_ARN`               | `arn:aws:iam::ACCOUNT:role/civil-platform-deploy` | yes      |
   | `AWS_REGION`                 | `eu-central-1`                                    | yes      |
   | `S3_BUCKET`                  | `my-civil-platform-site`                          | yes      |
   | `S3_PREFIX`                  | `civil`                                           | no       |
   | `BASE_PATH`                  | `/civil` (must match the URL prefix)              | no       |
   | `CLOUDFRONT_DISTRIBUTION_ID` | `E123ABC456DEF`                                   | no       |
   | `SITE_URL`                   | `https://civil.example.com`                       | no       |

   They are variables, not secrets: nothing here is a credential (access is by short-lived OIDC tokens).

## Releasing

```bash
git tag v0.5.0 && git push origin v0.5.0     # runs the pipeline
```

or _Actions → Deploy dist to AWS S3 → Run workflow_ (untick _upload_ for a build-and-check-only run).

Pipeline: lint → typecheck → all engineering tests → `pnpm build:dist` (integrity checks) → artifact (`dist/` only)
→ assume the AWS role via OIDC → sync `_next/static` (immutable, 1 year) → sync everything else (`no-cache`) →
CloudFront invalidation. The upload job is **skipped, not failed**, until the variables above exist.
To deploy on every push to `main` instead, change the trigger in `deploy-s3.yml` to `push: branches: [main]`.

**Rollback:** run the workflow from an older tag (_Run workflow → choose that tag_) or re-push a fixed tag; with
bucket versioning enabled individual objects can also be restored.

The GitHub Pages workflow (`pages.yml`) is independent and unchanged.
