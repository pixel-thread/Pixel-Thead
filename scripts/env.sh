

vercel env ls | awk '{print $1}' | tail -n +2 | xargs -I {} vercel env rm {} -y

cat .env.production | grep -v '^#' | grep -v '^$' | while IFS='=' read -r key value; do
  vercel env add "$key" production <<< "$value"
done
