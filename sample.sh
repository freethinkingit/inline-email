#!/usr/bin/env bash

# PREREQUISITE: npm install -g email-inliner-cli

# Build out the /out dir
mkdir -p out

# Manually feed html and css file
inline-email -f --inky --html in/sample.html --css in/sample.css --out out/single.html && open out/single.html
 
# Manually feed html and css files 
inline-email -f --inky --html in/sample.html --css in/sample.css in/second.css --out out/list.html && open out/list.html

# Link local file with manually fed HTML 
inline-email  -f --inky --html in/linked.html --out out/linked.html && open out/linked.html

# Default - Resolves <style> and <link> tags and removes them, after inlining them for effect.
inline-email in/linked.html