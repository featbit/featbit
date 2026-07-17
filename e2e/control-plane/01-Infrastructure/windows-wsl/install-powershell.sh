#!/bin/bash
###################################
# Prerequisites

# Update the list of packages
sudo apt-get update

# Install pre-requisite packages.
sudo apt-get install -y wget

# Download the PowerShell package file
wget https://github.com/PowerShell/PowerShell/releases/download/v7.6.0/powershell_7.6.0-1.deb_amd64.deb

###################################
# Install the PowerShell package
sudo dpkg -i powershell_7.6.0-1.deb_amd64.deb

# Resolve missing dependencies and finish the install (if necessary)
sudo apt-get install -f

# Delete the downloaded package file
rm powershell_7.6.0-1.deb_amd64.deb

# Start PowerShell
pwsh