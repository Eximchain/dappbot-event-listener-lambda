#!/bin/bash

BUNDLE_NAME=$1

# Install and copy over node_modules
npm install
rm -rf build/node_modules
cp -R node_modules build/node_modules

# Build, enter, and zip
rm -f $BUNDLE_NAME
tsc
cd build
zip -r ../$BUNDLE_NAME *
cd ..


