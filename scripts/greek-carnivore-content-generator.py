#!/usr/bin/env python3
"""
Enhanced Greek Carnivore Content Generator
Creates contextual descriptions based on video content and messaging
"""
import json
import random
from datetime import datetime
from typing import Dict, List, Optional

class GreekCarnivoreContentGenerator:
    def __init__(self):
        # Greek carnivore-specific content templates
        self.templates = {
            "diet_testing": {
                "hooks": [
                    "Δοκιμάζω την κάρνιβορ διατροφή για 30 μέρες",
                    "Η κάρνιβορ διατροφή άλλαξε τη ζωή μου",
                    "Τι συμβαίνει όταν τρως ΜΟΝΟ κρέας;",
                    "30 μέρες μόνο κρέας - Τα αποτελέσματα θα σε σοκάρουν"
                ],
                "descriptions": [
                    """🥩 Δοκιμάζω την κάρνιβορ διατροφή! 
Μόνο κρέας για έναν μήνα - δες τι συμβαίνει στο σώμα μου.
Περιγραφή περιήγησης για την κάρνιβορ ζωή! 💪

#ΚάρνιβορΔιατροφή #ΕλληνικήΚάρνιβορ #ΜόνοΚρέας #ΥγιεινήΖωή""",
                    
                    """🔥 Η κάρνιβορ διατροφή σε δράση!
Ξεκίνησα να αισθάνεσαι περιήγηση για το σώμα σου με εύκολες και πρακτικές κινήσεις.
Είσαι έτοιμος; 

💪 #ΑγαπήστεΤοΣώματαΣας #ΑπώλειαΒάρους #ΓρεεκΚάρνιβορ""",
                    
                    """🥩 ΚΡΕΑΣ = ΔΥΝΑΜΗ
Δες γιατί η κάρνιβορ διατροφή είναι το μυστικό για:
✅ Απώλεια βάρους
✅ Περισσότερη ενέργεια  
✅ Καλύτερη υγεία
✅ Ψυχική διαύγεια

#ΚάρνιβορΣτυλ #ΕλλάδαΚάρνιβορ #ΥγιεινήΔιατροφή"""
                ]
            },
            
            "transformation": {
                "hooks": [
                    "Πώς έχασα 15 κιλά σε 3 μήνες",
                    "Η μεταμόρφωσή μου με την κάρνιβορ",
                    "Από 90 κιλά σε 75 - Η ιστορία μου",
                    "Αυτό που κάνει η κάρνιβορ στο σώμα"
                ],
                "descriptions": [
                    """🔥 ΜΕΤΑΜΟΡΦΩΣΗ ALERT! 
Από 90 κιλά σε 75 σε 3 μήνες - ΜΟΝΟ με κάρνιβορ διατροφή!

✨ Τι άλλαξε:
• Απώλεια βάρους χωρίς πείνα
• Ενέργεια στα ύψη
• Καθαρό δέρμα
• Καλύτερος ύπνος

#ΚάρνιβορΜεταμόρφωση #ΑπώλειαΒάρους #ΕλληνικήΔιατροφή""",
                    
                    """💪 Η ΑΛΗΤΕΙΑ για την κάρνιβορ διατροφή!
Δες τη δική μου μεταμόρφωση και μάθε:
🥩 Τι τρώω κάθε μέρα
⏰ Πότε τρώω  
💡 Γιατί λειτουργεί

Είσαι έτοιμος για αλλαγή;

#ΚάρνιβορΖωή #ΕλλάδαΚάρνιβορ #ΥγιεινήΖωή"""
                ]
            },
            
            "daily_tips": {
                "hooks": [
                    "5 λόγοι να ξεκινήσεις κάρνιβορ ΣΗΜΕΡΑ",
                    "Το μυστικό που δεν σου λένε οι γιατροί",
                    "Γιατί το κρέας είναι η καλύτερη τροφή",
                    "Αυτό που δε ξέρεις για τη ζωική πρωτεΐνη"
                ],
                "descriptions": [
                    """🥩 ΚΑΡΝΙΒΟΡ ΣΥΜΒΟΥΛΗ ΤΗΣ ΗΜΕΡΑΣ!

Σήμερα μαθαίνουμε γιατί το κρέας είναι το ΤΕΛΕΙΟ φαγητό:
✅ Πλήρης πρωτεΐνη
✅ Βιταμίνες Β12 & σίδηρος
✅ Μηδέν υδατάνθρακες
✅ Φυσική κετόζη

Δοκίμασες ήδη; 

#ΚάρνιβορΣυμβουλές #ΕλληνικήΚάρνιβορ #ΥγιεινήΔιατροφή""",
                    
                    """💡 ΤΟ ΞΕΡΕΣ ΟΤΙ...
Η κάρνιβορ διατροφή είναι η πιο αρχαία διατροφή του ανθρώπου;

Οι πρόγονοί μας έτρωγαν ΜΟΝΟ ζωικές τροφές για χιλιάδες χρόνια!
Γι' αυτό το σώμα μας τα "θυμάται" αυτά τα φαγητά.

#ΚάρνιβορΙστορία #ΑρχαίαΔιατροφή #ΕλλάδαΚάρνιβορ"""
                ]
            },
            
            "food_showcase": {
                "hooks": [
                    "Το ΤΕΛΕΙΟ κάρνιβορ γεύμα",
                    "Τι τρώω σε μία μέρα - Κάρνιβορ edition",
                    "Ribeye vs Μοσχάρι - Ποιο είναι καλύτερο;",
                    "Η αλήθεια για τα όργανα (liver, heart)"
                ],
                "descriptions": [
                    """🍖 ΚΑΡΝΙΒΟΡ MEAL PREP!

Δες τι τρώω σε μία τυπική κάρνιβορ μέρα:
🌅 Πρωί: Αυγά + μπέικον
☀️ Μεσημέρι: Ribeye steak  
🌙 Βράδυ: Λάμπ τσοπς

Απλό, νόστιμο, αποτελεσματικό!

#ΚάρνιβορΦαγητό #ΜealPrep #ΕλληνικήΚάρνιβορ #Steak""",
                    
                    """🥩 RIBEYE = Ο ΒΑΣΙΛΙΑΣ των κρεάτων!

Γιατί το ribeye είναι το #1 κάρνιβορ φαγητό:
🔥 Υψηλά λιπαρά για ενέργεια
💪 Πλούσιο σε πρωτεΐνη  
😋 Απίστευτη γεύση
🧠 Ωμέγα-3 για τον εγκέφαλο

Έχεις δοκιμάσει;

#Ribeye #ΚάρνιβορΣτυλ #ΕλληνικόΚρέας"""
                ]
            }
        }
        
        self.hashtags_greek = [
            "#ΚάρνιβορΔιατροφή", "#ΕλληνικήΚάρνιβορ", "#ΜόνοΚρέας", 
            "#ΑπώλειαΒάρους", "#ΥγιεινήΖωή", "#ΚάρνιβορΣτυλ",
            "#ΕλλάδαΚάρνιβορ", "#ΚρεατοΦάγος", "#ΦυσικήΔιατροφή",
            "#ΠαλαιολιθικήΔιατροφή", "#ΚάρνιβορΜεταμόρφωση"
        ]
        
        self.english_hashtags = [
            "#Carnivore", "#CarnivoreLife", "#MeatOnly", "#CarnivoreDiet",
            "#ZeroCarb", "#AnimalBased", "#CarnivoreResults", "#GreekCarnivore",
            "#CarnivoreTransformation", "#MeatHeals"
        ]

    def generate_reel_description(self, 
                                 video_context: str, 
                                 content_type: str = "diet_testing",
                                 include_english: bool = True) -> Dict:
        """
        Generate Greek carnivore reel description based on video context
        
        Args:
            video_context: What's happening in the video (Greek or English)
            content_type: Type of content (diet_testing, transformation, daily_tips, food_showcase)
            include_english: Whether to include English hashtags
        """
        
        if content_type not in self.templates:
            content_type = "diet_testing"  # Default fallback
        
        template = self.templates[content_type]
        
        # Select hook and description
        hook = random.choice(template["hooks"])
        description = random.choice(template["descriptions"])
        
        # Add contextual elements based on video_context
        contextual_additions = self._get_contextual_additions(video_context, content_type)
        
        # Combine hashtags
        hashtags = random.sample(self.hashtags_greek, 4)  # 4 Greek hashtags
        if include_english:
            hashtags.extend(random.sample(self.english_hashtags, 3))  # 3 English hashtags
        
        final_description = description
        if contextual_additions:
            final_description += f"\n\n{contextual_additions}"
        
        final_description += f"\n\n{' '.join(hashtags)}"
        
        return {
            "hook": hook,
            "description": final_description,
            "hashtags": hashtags,
            "content_type": content_type,
            "character_count": len(final_description),
            "estimated_performance": self._estimate_performance(content_type, final_description)
        }

    def _get_contextual_additions(self, video_context: str, content_type: str) -> str:
        """Add context-specific content based on what's in the video"""
        
        context_lower = video_context.lower()
        additions = []
        
        # Check for specific elements in the video
        if "δοκιμάζει" in context_lower or "testing" in context_lower:
            additions.append("🎯 Παρακολούθησε το ταξίδι μου!")
            
        if "κρέας" in context_lower or "meat" in context_lower:
            additions.append("🥩 Quality κρέας = Quality αποτελέσματα")
            
        if "μεταμόρφωση" in context_lower or "transformation" in context_lower:
            additions.append("📸 Πριν/μετά φωτογραφίες σύντομα!")
            
        if "ribeye" in context_lower or "steak" in context_lower:
            additions.append("🔥 Grass-fed όταν γίνεται!")
            
        if "αποτελέσματα" in context_lower or "results" in context_lower:
            additions.append("📊 Τα νούμερα δε λένε ψέματα!")
        
        return " ".join(additions) if additions else ""

    def _estimate_performance(self, content_type: str, description: str) -> float:
        """Estimate performance score based on content analysis"""
        
        base_scores = {
            "transformation": 9.0,
            "diet_testing": 8.5,
            "food_showcase": 8.0,
            "daily_tips": 7.5
        }
        
        score = base_scores.get(content_type, 7.0)
        
        # Boost for engagement elements
        if "?" in description:
            score += 0.3
        if any(emoji in description for emoji in ["🥩", "🔥", "💪", "✅"]):
            score += 0.2
        if len(description) > 150 and len(description) < 300:  # Optimal length
            score += 0.3
        if "#" in description:
            score += 0.2
            
        return min(score, 10.0)

    def suggest_improvements(self, current_description: str) -> List[str]:
        """Suggest improvements for existing descriptions"""
        
        suggestions = []
        
        if len(current_description) > 400:
            suggestions.append("Μείωσε το μήκος - κάτω από 400 χαρακτήρες είναι καλύτερο")
            
        if not any(emoji in current_description for emoji in ["🥩", "🔥", "💪", "✅"]):
            suggestions.append("Πρόσθεσε emojis για περισσότερη προσοχή")
            
        if "#" not in current_description:
            suggestions.append("Πρόσθεσε hashtags για καλύτερη προβολή")
            
        if "?" not in current_description:
            suggestions.append("Πρόσθεσε ερώτηση για engagement")
            
        if not any(word in current_description.lower() for word in ["κάρνιβορ", "carnivore", "κρέας"]):
            suggestions.append("Συμπέριλαβε λέξεις-κλειδιά: κάρνιβορ, κρέας")
            
        return suggestions

# Example usage for the reel in the image
def generate_for_image_content():
    """Generate content for the specific reel shown in the image"""
    
    generator = GreekCarnivoreContentGenerator()
    
    # Based on the image: "Δοκιμάζει την Κάρνιβορ διατροφή"
    video_context = "Δοκιμάζει την κάρνιβορ διατροφή - testing carnivore diet lifestyle transformation"
    
    result = generator.generate_reel_description(
        video_context=video_context,
        content_type="diet_testing",
        include_english=True
    )
    
    return result

if __name__ == "__main__":
    # Test with the image content
    result = generate_for_image_content()
    print("GENERATED GREEK CARNIVORE REEL DESCRIPTION:")
    print("=" * 50)
    print(f"Hook: {result['hook']}")
    print(f"\nDescription:\n{result['description']}")
    print(f"\nCharacter Count: {result['character_count']}")
    print(f"Estimated Performance: {result['estimated_performance']}/10")