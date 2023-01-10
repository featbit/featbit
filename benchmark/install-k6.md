# Machine

- Ubuntu Server 20.04 LTS 64-bit (x86)
- AWS c6i.large ec2 instance

# Install k6
```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6=0.42.0
```

Run `k6 version` to check if k6 was successfully installed.

## Reference
- https://k6.io/docs/get-started/installation/
- https://k6.io/docs/get-started/installation/troubleshooting/
