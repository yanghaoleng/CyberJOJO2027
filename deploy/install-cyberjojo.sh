#!/usr/bin/env bash
set -euo pipefail

# Run on the existing CyberJOJO origin as root, after copying the two archives.
: "${RELEASE_TAG:?RELEASE_TAG is required}"
[[ "$RELEASE_TAG" =~ ^[a-zA-Z0-9._-]+$ ]]
static_dir="/var/www/jocam/releases/$RELEASE_TAG"
voice_dir="/opt/jocam-voice/releases/$RELEASE_TAG"
nginx_file="/etc/nginx/sites-enabled/cyberjojo.mikeywa.site"
nginx_backup="/tmp/cyberjojo-nginx-$RELEASE_TAG.backup"
previous_static="$(readlink -f /var/www/jocam/current)"
previous_voice="$(readlink -f /opt/jocam-voice/current)"
test -f /etc/jocam/voice.env
test -f "$previous_voice/server/node_modules/ws/package.json"
test ! -e "$static_dir"
test ! -e "$voice_dir"
mkdir -p "$static_dir" "$voice_dir"
tar -xzf "/tmp/cyberjojo-static-$RELEASE_TAG.tgz" -C "$static_dir"
tar -xzf "/tmp/cyberjojo-voice-$RELEASE_TAG.tgz" -C "$voice_dir"
test -s "$static_dir/index.html"
test -s "$static_dir/asset-catalog.json"
test -s "$voice_dir/server/gameplay-route.js"
# Fail before switching production if the preloaded cutout worker is unavailable.
curl --fail --silent --show-error http://127.0.0.1:8790/health >/dev/null
cp -a "$previous_voice/server/node_modules" "$voice_dir/server/node_modules"
cp -L "$nginx_file" "$nginx_backup"

rollback() {
  trap - ERR
  cp "$nginx_backup" "$nginx_file"
  ln -sfn "$previous_static" /var/www/jocam/current.rollback
  mv -Tf /var/www/jocam/current.rollback /var/www/jocam/current
  ln -sfn "$previous_voice" /opt/jocam-voice/current.rollback
  mv -Tf /opt/jocam-voice/current.rollback /opt/jocam-voice/current
  systemctl restart jocam-voice.service
  nginx -t && systemctl reload nginx
  echo "Release failed; restored the previous static and voice releases." >&2
  exit 1
}
trap rollback ERR
cp "$voice_dir/deploy/nginx-cyberjojo.conf" "$nginx_file"
nginx -t
ln -sfn "$static_dir" /var/www/jocam/current.next
mv -Tf /var/www/jocam/current.next /var/www/jocam/current
ln -sfn "$voice_dir" /opt/jocam-voice/current.next
mv -Tf /opt/jocam-voice/current.next /opt/jocam-voice/current
systemctl restart jocam-voice.service
systemctl is-active --quiet jocam-voice.service
systemctl reload nginx
curl --fail --silent --show-error --retry 8 --retry-connrefused --retry-delay 1 http://127.0.0.1:8787/health >/dev/null
curl --fail --silent --show-error --resolve cyberjojo.mikeywa.site:443:127.0.0.1 https://cyberjojo.mikeywa.site/assets/ >/dev/null
python3 "$voice_dir/deploy/record-release.py" --history /var/www/jocam/release-history.json --catalog "$static_dir/changelog.json" --seed "$voice_dir/deploy/release-history.seed.json" --tag "$RELEASE_TAG"
trap - ERR
echo "Released $RELEASE_TAG"
echo "Previous static: $previous_static"
echo "Previous voice: $previous_voice"
