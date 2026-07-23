# CyberWiki frontend — build SPA, serve with nginx
FROM node:25-alpine AS build

WORKDIR /app

# @cyberfabric/* packages are pinned to "alpha".
# If they live in a private registry, pass an .npmrc via build secret:
#   docker build --secret id=npmrc,src=$HOME/.npmrc .
# and uncomment the mount below.
COPY . .
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc,required=false \
    npm ci --ignore-scripts
# --ignore-scripts skips the prek (git hooks) postinstall, which fails outside a git checkout

RUN npm run build

FROM nginx:1.27-alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.default.conf.template /etc/nginx/templates/default.conf.template

# Backend service URL, substituted into the nginx config at container start
ENV BACKEND_URL=http://cyberwiki-backend:8000

EXPOSE 80
