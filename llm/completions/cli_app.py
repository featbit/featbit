import argparse

def main(name: str, age: int) -> None:
    message = f"Hello, {name}! You are {age} years old."
    print(message)

parser = argparse.ArgumentParser(description="Python CLI console app with --name and --age parameters.")
parser.add_argument("--name", required=True, help="Your name.")
parser.add_argument("--age", type=int, required=True, help="Your age.")

print("asdf")

args = parser.parse_args()
main(args.name, args.age)