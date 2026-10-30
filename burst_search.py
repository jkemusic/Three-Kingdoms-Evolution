"""窮舉 1 回合內純卡牌的爆發傷害 (不靠武將技能)。

傷害公式 (來自卡牌說明與實戰紀錄):
    每一次傷害 = (基礎傷害 + 固定加成) x 2^(強化張數)
    固定加成: 流星錘 +1 (每次傷害), 酒 +1 (只加在殺上, 假設一回合一張酒)
    強化 (⚡) 可疊: 實戰看過 x4

假設目標「無法回應」(沒有殺/閃/桃/無懈等), 只算理論上限。
每回合一張殺 (有諸葛連弩則不限)。只有一個武器欄 (甘寧/夏侯淵 可有 2 把)。
"""
from itertools import product

# 傷害牌: 名稱 -> (基礎傷害, 每回合張數上限, 備註)
DMG = {
    "殺": (1, 1, "需閃回應; 每回合1張(連弩不限)"),
    "決鬥": (1, 9, "需殺回應"),
    "南蠻入侵": (1, 9, "需殺回應"),
    "突襲": (1, 9, "需殺回應 (遇到第一個沒殺的人就停)"),
    "萬箭齊發": (1, 9, "需閃回應"),
    "飢餓": (1, 9, "需桃回應"),
    "火攻": (1, 9, "需同色牌; 火焰"),
    "笑裡藏刀": (1, 9, "可閃"),
}


def total(cards, n_buff, hammer, wine, crossbow, dual_weapon=False):
    """cards: dict name -> count. 回傳 (總傷害, 用到的牌張數)。"""
    flat = (1 if hammer else 0)
    total_dmg = 0
    used = 0
    wine_left = 1 if wine else 0
    for name, cnt in cards.items():
        base = DMG[name][0]
        for _ in range(cnt):
            f = flat
            if name == "殺" and wine_left:
                f += 1
                wine_left -= 1
            total_dmg += (base + f) * (2 ** n_buff)
            used += 1
    return total_dmg, used


def search(limit_cards=7, target=5, dual_weapon=False):
    res = []
    names = list(DMG)
    # 每種傷害牌 0..3 張 (殺在有連弩時可多張)
    for crossbow in (False, True):
        if crossbow and not dual_weapon:
            hammer_opts = (False,)   # 單武器: 連弩與流星錘不能並存
        else:
            hammer_opts = (False, True)
        if not crossbow:
            hammer_opts = (False, True)
        for hammer in hammer_opts:
            for wine in (False, True):
                for n_buff in range(0, 4):
                    for counts in product(range(0, 4), repeat=len(names)):
                        cards = {n: c for n, c in zip(names, counts) if c}
                        if not cards:
                            continue
                        if cards.get("殺", 0) > 1 and not crossbow:
                            continue
                        if wine and not cards.get("殺"):
                            continue
                        dmg, used = total(cards, n_buff, hammer, wine, crossbow)
                        extra = n_buff + (1 if hammer else 0) + (1 if wine else 0) + (1 if crossbow else 0)
                        n_cards = used + extra
                        if dmg >= target and n_cards <= limit_cards:
                            res.append((n_cards, dmg, crossbow, hammer, wine, n_buff, cards))
    res.sort(key=lambda r: (r[0], -r[1]))
    return res


def describe(r):
    n, dmg, cb, ha, wi, nb, cards = r
    parts = [f"{k}x{v}" for k, v in cards.items()]
    if ha: parts.append("流星錘")
    if cb: parts.append("諸葛連弩")
    if wi: parts.append("酒")
    if nb: parts.append(f"強化x{nb}")
    return f"{n}張牌 -> {dmg}傷害: " + " + ".join(parts)


if __name__ == "__main__":
    for dual in (False, True):
        print("=== 雙武器 (甘寧/夏侯淵)" if dual else "=== 一般 (單武器)")
        res = search(limit_cards=5, dual_weapon=dual)
        seen = set()
        shown = 0
        for r in res:
            key = (r[0], tuple(sorted(r[6].items())), r[2], r[3], r[4], r[5])
            if key in seen:
                continue
            seen.add(key)
            # 只列「最少張數」且不是單純多加牌的組合 (最多列 40 條)
            print(describe(r))
            shown += 1
            if shown >= 40:
                break
        print()
