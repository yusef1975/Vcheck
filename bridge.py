import os
import time
import shutil
import subprocess

PENDING_DIR = "prompts/pending"
BUILDING_DIR = "prompts/building"
COMPLETED_DIR = "prompts/completed"

def git_push_status(filename, status):
    try:
        subprocess.run(["git", "add", "."], check=True)
        subprocess.run(["git", "commit", "-m", f"Status Update: {filename} moved to {status}"], check=True)
        subprocess.run(["git", "push"], check=True)
        print(f"Successfully pushed status for {filename}")
    except subprocess.CalledProcessError as e:
        print(f"Error pushing to git: {e}")

def monitor_bridge():
    print(f"Monitoring {PENDING_DIR} for new tasks...")
    while True:
        if not os.path.exists(PENDING_DIR):
            os.makedirs(PENDING_DIR, exist_ok=True)
        
        files = [f for f in os.listdir(PENDING_DIR) if f.endswith(".md")]
        
        for file in files:
            source_path = os.path.join(PENDING_DIR, file)
            dest_path = os.path.join(BUILDING_DIR, file)
            
            print(f"New task detected: {file}")
            
            # Ensure building dir exists
            os.makedirs(BUILDING_DIR, exist_ok=True)
            
            # Move to building
            shutil.move(source_path, dest_path)
            print(f"Moved {file} to {BUILDING_DIR}")
            
            # Push status
            git_push_status(file, "building")
            
            # Read content to display for the AI agent (Antigravity)
            with open(dest_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            print("\n" + "="*50)
            print(f"TASK CONTENT FROM {file}:")
            print("-" * 50)
            print(content)
            print("="*50 + "\n")
            
            print("Awaiting execution... (AI should pick this up now)")
            # In a real background script, we might stop or wait for a signal.
            # For this bridge, we continue monitoring after reporting.
            
        time.sleep(5)

if __name__ == "__main__":
    monitor_bridge()
