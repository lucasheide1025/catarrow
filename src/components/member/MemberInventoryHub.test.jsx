import React from "react";
import MemberInventoryHub from "./MemberInventoryHub";
import { HubTile } from "../shared/Widgets";

function collectElements(node, predicate, matches = []) {
  if (!React.isValidElement(node)) return matches;
  if (predicate(node)) matches.push(node);
  React.Children.forEach(node.props.children, child => collectElements(child, predicate, matches));
  return matches;
}

test("renders the five related features as illustrated hub tiles", () => {
  const onPageChange = jest.fn();
  const tree = MemberInventoryHub({ onPageChange });
  const tiles = collectElements(tree, element => element.type === HubTile);
  const relatedTiles = tiles.filter(tile => [
    "專精與符文",
    "我的裝備",
    "怪物卡片",
    "金幣商店",
    "貓貓陪練",
  ].includes(tile.props.title));

  expect(relatedTiles).toHaveLength(5);
  const expected = [
    ["專精與符文", "戰鬥流派・符文製作", /specialization-runes-v1(?:\.[a-f0-9]+)?\.webp$/],
    ["我的裝備", "穿戴・強化・外觀", /equipment(?:\.[a-f0-9]+)?\.webp$/],
    ["怪物卡片", "收藏・升星・加成", /cards(?:\.[a-f0-9]+)?\.webp$/],
    ["金幣商店", "每日精選・每週珍寶", /shop(?:\.[a-f0-9]+)?\.webp$/],
    ["貓貓陪練", "九隻貓咪夥伴", /companions(?:\.[a-f0-9]+)?\.webp$/],
  ];
  relatedTiles.forEach((tile, index) => {
    expect(tile.props.title).toBe(expected[index][0]);
    expect(tile.props.desc).toBe(expected[index][1]);
    expect(tile.props.image).toMatch(expected[index][2]);
  });

  const expectedPages = [
    "specialization-runes",
    "equipment",
    "cards",
    "coinshop",
    "cats",
  ];
  relatedTiles.forEach((tile, index) => tile.props.onClick());
  expect(onPageChange.mock.calls.map(([page]) => page)).toEqual(expectedPages);
});

test("preserves inventory category navigation and badge counts", () => {
  const onPageChange = jest.fn();
  const badges = { chests:3, potions:2, materials:7, fragments:4, special:1 };
  const tree = MemberInventoryHub({ onPageChange, badges });
  const tiles = collectElements(tree, element => element.type === HubTile).slice(0, 5);

  expect(tiles.map(tile => tile.props.title)).toEqual([
    "戰利品", "藥水", "怪物素材", "徽章碎片", "特殊道具",
  ]);
  expect(tiles.map(tile => tile.props.badge)).toEqual([3, 2, 7, 4, 1]);

  tiles.forEach(tile => tile.props.onClick());
  expect(onPageChange).toHaveBeenCalledTimes(5);
  expect(onPageChange.mock.calls.every(([page]) => page === "materials")).toBe(true);
  expect(sessionStorage.getItem("inventory_initial_tab")).toBe("special");
});
