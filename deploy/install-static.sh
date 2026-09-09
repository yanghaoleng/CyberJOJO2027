#!/usr/bin/env bash
set -euo pipefail

# Copy this deploy folder and /tmp/cyberjojo-static-$RELEASE_TAG.tgz to the origin.
: "${RELEASE_TAG:?RELEASE_TAG is required}"
[[ "$RELEASE_TAG" =~ ^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$ && "$RELEASE_TAG" != *..* ]]
tools_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
release_dir="/var/www/jocam/releases/$RELEASE_TAG"
previous="$(readlink -f /var/www/jocam/current)"
nginx_file="/etc/nginx/sites-enabled/cyberjojo.mikeywa.site"
nginx_backup="/tmp/cyberjojo-nginx-$RELEASE_TAG.backup"
test ! -e "$release_dir"
test -f "$previous/index.html"
mkdir -p "$release_dir"
tar -xzf "/tmp/cyberjojo-static-$RELEASE_TAG.tgz" -C "$release_dir"
test -s "$release_dir/index.html"
test -s "$release_dir/changelog.json"
cp -L "$nginx_file" "$nginx_backup"
rollback() {
  trap - ERR
  cp "$nginx_backup" "$nginx_file"
  ln -sfn "$previous" /var/www/jocam/current.rollback
  mv -Tf /var/www/jocam/current.rollback /var/www/jocam/current
  nginx -t && systemctl reload nginx
  echo "Static release failed; restored $previous" >&2
  exit 1
}
trap rollback ERR
cp "$tools_dir/nginx-cyberjojo.conf" "$nginx_file"
nginx -t
ln -sfn "$release_dir" /var/www/jocam/current.next
mv -Tf /var/www/jocam/current.next /var/www/jocam/current
systemctl reload nginx
curl --fail --silent --show-error --resolve cyberjojo.mikeywa.site:443:127.0.0.1 https://cyberjojo.mikeywa.site/changelog/ >/dev/null
curl --fail --silent --show-error --resolve cyberjojo.mikeywa.site:443:127.0.0.1 https://cyberjojo.mikeywa.site/assets/ >/dev/null
python3 "$tools_dir/record-release.py" --history /var/www/jocam/release-history.json --catalog "$release_dir/changelog.json" --seed "$tools_dir/release-history.seed.json" --tag "$RELEASE_TAG"
trap - ERR
echo "Released $RELEASE_TAG; previous static: $previous"
