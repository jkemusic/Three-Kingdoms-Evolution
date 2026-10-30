"""武將關卡: 每位武將一關。你扮演他,桌上有現成的牌和對手,照技能說明試用一次。
(技能的觸發在紀錄裡會寫成「[武將名]」,偵測到就算完成;少數被動技能沒有這種紀錄,改成自由練習。)"""
import re


def build_generals(m, roster_data, untagged):
    for d in roster_data:
        name = d["name"]
        tag = None if name in untagged else rf"P0\([^)]*\)[^\n]*\[{re.escape(name)}[^\]]*\]|\[{re.escape(name)}[^\]]*\][^\n]*P0\("
        steps = [("照上面的技能說明,打出能觸發「" + name + "」的牌或情況 (對手 P1 會對你出一張殺)", tag)] if tag else []
        L = m.lesson("g_" + name, "武將", name, f"{d['faction']}  體力 {d['maxhp']}  —  " + " / ".join(x.split('. ', 1)[-1] for x in d["skills"]),
                     m.pad([dict(hand=["殺", "殺", "決", "順", "過", "桃", "閃", "無", "南"]),
                            dict(hand=["殺", "閃"], plan=[("殺", 0)], hp=4, maxhp=4), dict(hand=["桃", "殺"], hp=4, maxhp=4), dict(hand=["閃", "閃"], hp=4, maxhp=4)]),
                     steps, tips=list(d["skills"]) + ["這關沒有目標限制: 隨意出牌,多試幾種組合,看看技能怎麼發動。想結束隨時可以離開。"],
                     chars=[name, None, None, None], draw=1)
        L["free"] = not steps
        L["faction"] = d["faction"]
