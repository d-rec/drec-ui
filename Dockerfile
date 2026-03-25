FROM node:20-alpine AS build
ARG build_environment
ENV BUILD_ENVIRONMENT=$build_environment

RUN apk add --no-cache bash

WORKDIR /dist/src/app
RUN npm cache clean --force
COPY . .

# environment.ts is gitignored; copy the target environment file so Angular
# file-replacement has a base file to swap out during the build.
RUN cp src/environments/environment.${BUILD_ENVIRONMENT}.ts src/environments/environment.ts

RUN npm install --legacy-peer-deps
RUN npm run build -- --configuration=$BUILD_ENVIRONMENT

FROM nginx:alpine AS nginx

RUN rm -rf /usr/share/nginx/html/*
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

WORKDIR /usr/share/nginx/html

COPY --from=build /dist/src/app/dist/origin-drec-angular-ui/ .

CMD ["nginx", "-g", "daemon off;"]
