#!/usr/bin/env bash
# Use this script to validate the UI changes
# This script should be ran after running npm run i18n

# Reset
COLOR_OFF='\033[0m'       # Text Reset
RED='\033[0;31m'          # Red
GREEN='\033[0;32m'        # Green


# i18n validations
echo "i18n validations: Validating i18n..."
echo "$PWD"
if grep -Fxq "<target></target>" ./src/locale/messages.zh.xlf
then
  echo -e "${RED}i18n validations: Empty translations found in src/locale/messages.zh.xlf${COLOR_OFF}"
  exit 1
else
  echo -e "${GREEN}i18n validations: Passed${COLOR_OFF}"
fi
