#!/bin/bash

rm -rf extension.zip

source .env

echo "Backend URL: $BACKEND_URL"
echo "Moodle URL: $MOODLE_URL"
echo "Public Key: $PUBLIC_KEY"

BACKEND_URL=$(echo $BACKEND_URL | sed 's/\//\\\//g')
MOODLE_URL=$(echo $MOODLE_URL | sed 's/\//\\\//g')
PUBLIC_KEY=$(echo $PUBLIC_KEY | sed 's/\//\\\//g')

cp manifest.template.json manifest.json
cat manifest.template.json | \
    sed "s/BACKEND_URL/$BACKEND_URL/g" | \
    sed "s/MOODLE_URL/$MOODLE_URL/g" | \
    sed "s/PUBLIC_KEY/$PUBLIC_KEY/g" > manifest.json

zip -r extension.zip . -x@.crxignore