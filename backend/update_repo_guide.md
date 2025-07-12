# Updating SikumAI Repository with Memory Optimizations

## Step 1: Navigate to Your Repository
```bash
cd /path/to/your/SikumAI
```

## Step 2: Check Current Status
```bash
git status
```

## Step 3: Add the Optimized Files
```bash
# Add the backend optimizations
git add backend/app.py
git add backend/requirements.txt
git add backend/question_generator.py
git add backend/README.md

# Check what will be committed
git diff --cached
```

## Step 4: Commit the Changes
```bash
git commit -m "🚀 Memory optimization: Reduce backend memory usage from 699MB to ~150MB

- Implement lazy loading for QuestionGenerator
- Remove heavy dependencies (unstructured, langchain, openai)
- Add explicit memory cleanup after file processing
- Optimize imports and remove redundant libraries
- Add memory optimization documentation

Expected reduction: ~550MB (78% memory savings)"
```

## Step 5: Push to GitHub
```bash
git push origin main
# or if your default branch is master:
# git push origin master
```

## Step 6: Verify on GitHub
1. Go to https://github.com/buzagloidan/SikumAI
2. Check that your changes are reflected
3. Review the updated README.md for memory optimization documentation

## Files Changed:
- `backend/app.py` - Lazy loading implementation
- `backend/requirements.txt` - Removed heavy dependencies
- `backend/question_generator.py` - Optimized imports
- `backend/README.md` - Added memory optimization docs

## Expected Impact:
- Memory usage: 699MB → ~150MB (78% reduction)
- Faster startup time
- Lower hosting costs
- Better performance 