"""Train a small RGB + transformed-disparity pothole segmentation baseline."""

from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path

import cv2
import numpy as np
import torch
from torch import Tensor, nn
from torch.nn import functional as functional
from torch.utils.data import DataLoader, Dataset


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DATA = PROJECT_ROOT / "ai_engine" / "data" / "processed" / "ruaskita-depth-aware-v0.1"
DEFAULT_ARTIFACTS = PROJECT_ROOT / "ai_engine" / "artifacts" / "depth-aware-v0.1"


class Pothole600Dataset(Dataset[tuple[Tensor, Tensor]]):
    def __init__(self, root: Path, split: str, size: int) -> None:
        self.rgb = sorted((root / split / "rgb").glob("*.png"))
        self.root, self.split, self.size = root, split, size
        if not self.rgb:
            raise RuntimeError(f"No samples in {root / split / 'rgb'}")

    def __len__(self) -> int:
        return len(self.rgb)

    def __getitem__(self, index: int) -> tuple[Tensor, Tensor]:
        path = self.rgb[index]
        rgb = cv2.cvtColor(cv2.imread(str(path), cv2.IMREAD_COLOR), cv2.COLOR_BGR2RGB)
        disparity = cv2.imread(str(self.root / self.split / "tdisp" / path.name), cv2.IMREAD_GRAYSCALE)
        mask = cv2.imread(str(self.root / self.split / "mask" / path.name), cv2.IMREAD_GRAYSCALE)
        if rgb is None or disparity is None or mask is None:
            raise RuntimeError(f"Unreadable pair: {path}")
        # In Pothole-600, the modal pixel value is background; this avoids
        # assuming a particular black/white mask convention.
        values, counts = np.unique(mask, return_counts=True)
        mask = (mask != values[np.argmax(counts)]).astype(np.float32)
        rgb = cv2.resize(rgb, (self.size, self.size), interpolation=cv2.INTER_AREA).astype(np.float32) / 255.0
        disparity = cv2.resize(disparity, (self.size, self.size), interpolation=cv2.INTER_AREA).astype(np.float32) / 255.0
        mask = cv2.resize(mask, (self.size, self.size), interpolation=cv2.INTER_NEAREST)
        features = np.concatenate((rgb.transpose(2, 0, 1), disparity[None]), axis=0)
        return torch.from_numpy(features), torch.from_numpy(mask[None])


class DoubleConv(nn.Module):
    def __init__(self, channels_in: int, channels_out: int) -> None:
        super().__init__()
        self.layers = nn.Sequential(nn.Conv2d(channels_in, channels_out, 3, padding=1), nn.BatchNorm2d(channels_out), nn.SiLU(), nn.Conv2d(channels_out, channels_out, 3, padding=1), nn.BatchNorm2d(channels_out), nn.SiLU())

    def forward(self, tensor: Tensor) -> Tensor:
        return self.layers(tensor)


class DepthAwareUNet(nn.Module):
    def __init__(self) -> None:
        super().__init__()
        self.enc1, self.enc2, self.enc3 = DoubleConv(4, 32), DoubleConv(32, 64), DoubleConv(64, 128)
        self.pool = nn.MaxPool2d(2)
        self.bottleneck = DoubleConv(128, 256)
        self.up3, self.dec3 = nn.ConvTranspose2d(256, 128, 2, 2), DoubleConv(256, 128)
        self.up2, self.dec2 = nn.ConvTranspose2d(128, 64, 2, 2), DoubleConv(128, 64)
        self.up1, self.dec1 = nn.ConvTranspose2d(64, 32, 2, 2), DoubleConv(64, 32)
        self.head = nn.Conv2d(32, 1, 1)

    def forward(self, tensor: Tensor) -> Tensor:
        first = self.enc1(tensor)
        second = self.enc2(self.pool(first))
        third = self.enc3(self.pool(second))
        bottleneck = self.bottleneck(self.pool(third))
        third_up = self.dec3(torch.cat((self.up3(bottleneck), third), dim=1))
        second_up = self.dec2(torch.cat((self.up2(third_up), second), dim=1))
        first_up = self.dec1(torch.cat((self.up1(second_up), first), dim=1))
        return self.head(first_up)


def dice_iou(logits: Tensor, target: Tensor) -> tuple[float, float]:
    prediction = (torch.sigmoid(logits) >= 0.5).float()
    intersection = (prediction * target).sum().item()
    total = prediction.sum().item() + target.sum().item()
    dice = (2 * intersection + 1e-6) / (total + 1e-6)
    union = prediction.sum().item() + target.sum().item() - intersection
    return dice, (intersection + 1e-6) / (union + 1e-6)


def evaluate(model: nn.Module, loader: DataLoader, device: torch.device) -> dict[str, float]:
    model.eval()
    metrics: Counter[str] = Counter()
    with torch.no_grad():
        for features, target in loader:
            logits = model(features.to(device))
            dice, iou = dice_iou(logits, target.to(device))
            metrics["dice"] += dice
            metrics["iou"] += iou
            metrics["samples"] += 1
    return {"dice": metrics["dice"] / metrics["samples"], "iou": metrics["iou"] / metrics["samples"]}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", type=Path, default=DEFAULT_DATA)
    parser.add_argument("--epochs", type=int, default=40)
    parser.add_argument("--batch-size", type=int, default=4)
    parser.add_argument("--image-size", type=int, default=384)
    parser.add_argument("--device", default="cuda" if torch.cuda.is_available() else "cpu")
    parser.add_argument("--output", type=Path, default=DEFAULT_ARTIFACTS)
    args = parser.parse_args()
    torch.manual_seed(42)
    device = torch.device(args.device)
    train = DataLoader(Pothole600Dataset(args.data, "train", args.image_size), batch_size=args.batch_size, shuffle=True, num_workers=0)
    validation = DataLoader(Pothole600Dataset(args.data, "val", args.image_size), batch_size=args.batch_size, num_workers=0)
    test = DataLoader(Pothole600Dataset(args.data, "test", args.image_size), batch_size=args.batch_size, num_workers=0)
    model = DepthAwareUNet().to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=3e-4, weight_decay=1e-4)
    bce = nn.BCEWithLogitsLoss()
    best_iou, history = -1.0, []
    args.output.mkdir(parents=True, exist_ok=True)
    for epoch in range(1, args.epochs + 1):
        model.train()
        loss_sum = 0.0
        for features, target in train:
            features, target = features.to(device), target.to(device)
            logits = model(features)
            probabilities = torch.sigmoid(logits)
            soft_dice = 1 - (2 * (probabilities * target).sum() + 1e-6) / (probabilities.sum() + target.sum() + 1e-6)
            loss = bce(logits, target) + soft_dice
            optimizer.zero_grad(set_to_none=True)
            loss.backward()
            optimizer.step()
            loss_sum += loss.item()
        metrics = evaluate(model, validation, device)
        row = {"epoch": epoch, "train_loss": loss_sum / len(train), **metrics}
        history.append(row)
        print(row)
        if metrics["iou"] > best_iou:
            best_iou = metrics["iou"]
            torch.save({"model": model.state_dict(), "epoch": epoch, "validation": metrics, "input": "RGB + transformed disparity", "measurement_policy": "not metric depth"}, args.output / "best.pt")
    checkpoint = torch.load(args.output / "best.pt", map_location=device, weights_only=True)
    model.load_state_dict(checkpoint["model"])
    report = {"best_epoch": checkpoint["epoch"], "validation": checkpoint["validation"], "test": evaluate(model, test, device), "history": history, "input": "RGB + transformed disparity", "measurement_policy": "Relative-depth research only; no centimetre claims."}
    (args.output / "report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
