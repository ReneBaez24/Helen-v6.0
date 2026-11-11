"""
Append NEW gestures to the existing training data without re-processing the old videos.

Use this when the original videos of the existing gestures are not available
(only data/X_data.npy, data/Y_labels.npy and data/gestures_map.json are).

The new gesture gets the next free ID (e.g. 'calendario' -> 10), so the IDs of
the existing gestures do not change.

Usage:
    python add_gesture_data.py --dataset ../dataset_nuevos --gestures calendario

    ../dataset_nuevos/
        calendario/
            calendario_1.mp4
            calendario_2.mp4
            ...

A backup of the current data files is written to data/backup_<timestamp>/ first.
After this, retrain with: python train_solid.py  (option 1)
"""

import argparse
import json
import shutil
import sys
import time
from pathlib import Path

import numpy as np

from data_prep import DataPreparator

DATA_FILES = ("X_data.npy", "Y_labels.npy", "gestures_map.json")


def extract_gesture(preparator, gesture_folder):
    """Extract standardized landmark sequences for every video of one gesture."""
    videos = sorted(gesture_folder.glob("*.mp4"))
    sequences = []
    skipped = 0
    for video in videos:
        seq = preparator.extract_landmarks_from_video(video)
        if seq is None:
            skipped += 1
            print(f"  ! No hands detected, skipped: {video.name}")
            continue
        sequences.append(preparator.standardize_sequence(seq))
    return sequences, len(videos), skipped


def main():
    parser = argparse.ArgumentParser(description="Append new gestures to Helen training data")
    parser.add_argument("--dataset", required=True, help="Folder that contains one subfolder per NEW gesture")
    parser.add_argument("--gestures", nargs="+", required=True, help="Names of the new gestures (subfolder names)")
    parser.add_argument("--data-dir", default="data", help="Folder with X_data.npy, Y_labels.npy, gestures_map.json")
    parser.add_argument("--seq-length", type=int, default=40)
    args = parser.parse_args()

    dataset = Path(args.dataset)
    data_dir = Path(args.data_dir)

    # Load current data
    X = np.load(data_dir / "X_data.npy")
    Y = np.load(data_dir / "Y_labels.npy")
    with open(data_dir / "gestures_map.json") as f:
        gestures_map = json.load(f)
    print(f"Current data: {X.shape[0]} samples, {len(gestures_map)} gestures")

    # Validate before touching anything
    for name in args.gestures:
        if name in gestures_map:
            sys.exit(f"Error: '{name}' already exists with ID {gestures_map[name]}. "
                     f"Use train_solid.py option 3 + full data_prep instead.")
        if not (dataset / name).is_dir():
            sys.exit(f"Error: folder not found: {dataset / name}")

    preparator = DataPreparator(dataset, seq_length=args.seq_length)

    new_X, new_Y = [], []
    next_id = max(gestures_map.values()) + 1
    for name in args.gestures:
        print(f"\nProcessing '{name}' -> ID {next_id}")
        sequences, total, skipped = extract_gesture(preparator, dataset / name)
        if not sequences:
            sys.exit(f"Error: no usable videos for '{name}' ({total} found, {skipped} skipped)")
        print(f"  {len(sequences)} samples ({skipped} skipped of {total})")
        new_X.extend(sequences)
        new_Y.extend([next_id] * len(sequences))
        gestures_map[name] = next_id
        next_id += 1

    new_X = np.asarray(new_X, dtype=X.dtype)
    if new_X.shape[1:] != X.shape[1:]:
        sys.exit(f"Error: shape mismatch, new data {new_X.shape[1:]} vs existing {X.shape[1:]}")

    # Backup, then write
    backup = data_dir / f"backup_{time.strftime('%Y%m%d_%H%M%S')}"
    backup.mkdir()
    for fname in DATA_FILES:
        shutil.copy2(data_dir / fname, backup / fname)
    print(f"\nBackup saved in: {backup}")

    X_out = np.concatenate([X, new_X])
    Y_out = np.concatenate([Y, np.asarray(new_Y, dtype=Y.dtype)])
    np.save(data_dir / "X_data.npy", X_out)
    np.save(data_dir / "Y_labels.npy", Y_out)
    with open(data_dir / "gestures_map.json", "w") as f:
        json.dump(gestures_map, f, indent=2)

    print(f"\nNew data: {X_out.shape[0]} samples, {len(gestures_map)} gestures")
    for name, gid in sorted(gestures_map.items(), key=lambda kv: kv[1]):
        print(f"  {gid}: {name} = {int(np.sum(Y_out == gid))} samples")
    print("\nNext step: python train_solid.py  ->  option 1 (train)")


if __name__ == "__main__":
    main()
