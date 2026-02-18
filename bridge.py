import os
import time
import subprocess
import shutil

REPO_PATH = os.path.dirname(os.path.abspath(__file__))
PENDING_DIR = os.path.join(REPO_PATH, "prompts", "pending")
BUILDING_DIR = os.path.join(REPO_PATH, "prompts", "building")
COMPLETED_DIR = os.path.join(REPO_PATH, "prompts", "completed")

def run_git(args):
    try:
        subprocess.run(["git"] + args, cwd=REPO_PATH, check=True, capture_output=True)
    except subprocess.CalledProcessError as e:
        print(f"Git error: {e.stderr.decode()}")

def check_for_prompts():
    print("Checking for prompts...")
    run_git(["pull"])
    
    if not os.path.exists(PENDING_DIR):
        os.makedirs(PENDING_DIR, exist_ok=True)
        return None

    files = [f for f in os.listdir(PENDING_DIR) if f.endswith(".md")]
    if files:
        target_file = files[0]
        print(f"Found prompt: {target_file}")
        
        # Move to building
        os.makedirs(BUILDING_DIR, exist_ok=True)
        shutil.move(os.path.join(PENDING_DIR, target_file), os.path.join(BUILDING_DIR, target_file))
        
        # Commit and push
        run_git(["add", "."])
        run_git(["commit", "-m", f"Building: {target_file}"])
        run_git(["push"])
        
        return target_file
    return None

if __name__ == "__main__":
    while True:
        prompt = check_for_prompts()
        if prompt:
            print(f"!!! NEW PROMPT DETECTED: {prompt} !!!")
            print("Please process this prompt in the chat.")
        time.sleep(30)
