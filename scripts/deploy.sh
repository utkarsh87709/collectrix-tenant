#!/usr/bin/env bash
# Build the app and publish it to devtenant.collectrix.ai (S3 behind CloudFront).
#   npm run deploy
# Needs the AWS CLI signed in (`aws configure`). The bucket and the CloudFront
# distribution are looked up from the domain, so there's nothing else to set.
set -euo pipefail

DOMAIN="${DEPLOY_DOMAIN:-devtenant.collectrix.ai}"

cd "$(dirname "$0")/.."

command -v aws >/dev/null || { echo "AWS CLI not found. Install it with: brew install awscli"; exit 1; }
aws sts get-caller-identity >/dev/null 2>&1 || { echo "AWS isn't signed in. Run: aws configure"; exit 1; }

echo "→ Looking up $DOMAIN"
read -r DIST_ID ORIGIN < <(aws cloudfront list-distributions --output text \
  --query "DistributionList.Items[?Aliases.Items && contains(Aliases.Items, '$DOMAIN')] | [0].[Id, Origins.Items[0].DomainName]")
if [[ -z "${DIST_ID:-}" || "$DIST_ID" == "None" ]]; then
  echo "No CloudFront distribution found for $DOMAIN"; exit 1
fi
# Origin is <bucket>.s3.<region>.amazonaws.com or <bucket>.s3-website-<region>.amazonaws.com
BUCKET="${ORIGIN%.s3[.-]*}"
echo "  bucket s3://$BUCKET · distribution $DIST_ID"

echo "→ Building"
npm run build

echo "→ Uploading"
# Overwrite only, no --delete: old asset files stay so tabs opened before the
# deploy can still load their chunks.
aws s3 sync dist "s3://$BUCKET" --exclude index.html --only-show-errors
# index.html names the new asset files, so browsers must always re-fetch it.
aws s3 cp dist/index.html "s3://$BUCKET/index.html" --cache-control no-cache --only-show-errors

echo "→ Clearing the CloudFront cache (usually 1–2 minutes)"
INVALIDATION_ID=$(aws cloudfront create-invalidation --distribution-id "$DIST_ID" --paths "/*" \
  --query Invalidation.Id --output text)
aws cloudfront wait invalidation-completed --distribution-id "$DIST_ID" --id "$INVALIDATION_ID"

echo "✓ Live at https://$DOMAIN"
