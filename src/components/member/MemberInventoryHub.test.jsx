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
  relatedTiles.forEach(tile => expect(tile.props.image).toBeTruthy());

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
